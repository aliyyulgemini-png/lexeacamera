import { ResponseError } from "../../error/response-error.js";
import { prisma } from "../../lib/database.js";
import { describeIp, matchesAnyCidr } from "../../utils/network.js";
import { verifyPin } from "../../utils/secret.js";
import { attendValidation } from "../../validation/public/attendance-validation.js";
import { validate } from "../../validation/validation.js";

const MAX_FAILED_PINS = 5;
const PIN_LOCK_MS = 15 * 60 * 1000;
const MIN_GAP_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

const wibDay = (date) =>
  new Date(date.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);

const isReady = (employee) =>
  employee.is_active &&
  employee.pin_hash !== null &&
  (employee.email_verified_at !== null || employee.user_id !== null);

const assertNetworkAllowed = async (ip) => {
  const store = await prisma.store.findFirst({
    orderBy: { id: "asc" },
    select: { attendance_require_network: true },
  });

  if (!store) {
    throw new ResponseError(503, "STORE_NOT_READY");
  }
  if (!store.attendance_require_network) return;

  const [networks, devices] = await Promise.all([
    prisma.attendanceNetwork.findMany({
      where: { is_active: true },
      select: { cidr: true },
    }),
    prisma.attendanceDevice.findMany({
      where: { is_active: true },
      select: { ip_v4: true, ip_v6: true },
    }),
  ]);

  const cidrs = [
    ...networks.map((network) => network.cidr),
    ...devices.flatMap((device) =>
      [device.ip_v4 ? `${device.ip_v4}/32` : null, device.ip_v6].filter(
        Boolean,
      ),
    ),
  ];

  if (!matchesAnyCidr(ip, cidrs)) {
    throw new ResponseError(403, "NETWORK_NOT_ALLOWED");
  }
};

const authenticate = async (employeeId, pin) => {
  const now = new Date();

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      name: true,
      is_active: true,
      user_id: true,
      pin_hash: true,
      email_verified_at: true,
      pin_failed_count: true,
      pin_locked_until: true,
    },
  });

  if (!employee || !isReady(employee)) {
    throw new ResponseError(404, "EMPLOYEE_NOT_FOUND");
  }
  if (employee.pin_locked_until && employee.pin_locked_until > now) {
    throw new ResponseError(429, "PIN_LOCKED");
  }

  if (await verifyPin(pin, employee.pin_hash)) {
    if (employee.pin_failed_count > 0 || employee.pin_locked_until) {
      await prisma.employee.update({
        where: { id: employee.id },
        data: { pin_failed_count: 0, pin_locked_until: null },
      });
    }

    return employee;
  }

  const { pin_failed_count: failed } = await prisma.employee.update({
    where: { id: employee.id },
    data: { pin_failed_count: { increment: 1 } },
    select: { pin_failed_count: true },
  });

  if (failed >= MAX_FAILED_PINS) {
    await prisma.employee.update({
      where: { id: employee.id },
      data: {
        pin_failed_count: 0,
        pin_locked_until: new Date(now.getTime() + PIN_LOCK_MS),
      },
    });
  }

  throw new ResponseError(401, "INVALID_PIN");
};

const withEmployeeLock = (employeeId, action) =>
  prisma
    .$transaction(async (tx) => {
      const locked = await tx.$queryRaw`
        SELECT id FROM "Employee" WHERE id = ${employeeId} FOR UPDATE
      `;

      const employee = locked.length
        ? await tx.employee.findUnique({
            where: { id: employeeId },
            select: {
              is_active: true,
              user_id: true,
              pin_hash: true,
              email_verified_at: true,
            },
          })
        : null;

      if (!employee || !isReady(employee)) {
        throw new ResponseError(404, "EMPLOYEE_NOT_FOUND");
      }

      return action(tx);
    })
    .catch((error) => {
      if (error.code === "P2002") {
        throw new ResponseError(409, "ALREADY_CHECKED_IN");
      }

      throw error;
    });

const findOpen = (tx, employeeId) =>
  tx.attendance.findFirst({
    where: {
      employee_id: employeeId,
      check_out_at: null,
      missed_checkout: false,
    },
    orderBy: { check_in_at: "desc" },
    select: { id: true, check_in_at: true },
  });

const getEmployees = async (request) => {
  await assertNetworkAllowed(request.ip);

  const employees = await prisma.employee.findMany({
    where: {
      is_active: true,
      pin_hash: { not: null },
      OR: [{ email_verified_at: { not: null } }, { user_id: { not: null } }],
    },
    select: { id: true, name: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });

  return employees;
};

const checkIn = async (request) => {
  const req = validate(attendValidation, request.body ?? {});

  await assertNetworkAllowed(request.ip);
  const employee = await authenticate(req.employee_id, req.pin);

  return withEmployeeLock(employee.id, async (tx) => {
    const now = new Date();
    const open = await findOpen(tx, employee.id);

    if (open) {
      if (wibDay(open.check_in_at) === wibDay(now)) {
        throw new ResponseError(409, "ALREADY_CHECKED_IN");
      }

      await tx.attendance.update({
        where: { id: open.id },
        data: { missed_checkout: true },
      });
    }

    const dayStart = new Date(`${wibDay(now)}T00:00:00+07:00`);
    const attendedToday = await tx.attendance.findFirst({
      where: {
        employee_id: employee.id,
        check_in_at: {
          gte: dayStart,
          lt: new Date(dayStart.getTime() + DAY_MS),
        },
      },
      select: { id: true },
    });

    if (attendedToday) {
      throw new ResponseError(409, "ALREADY_ATTENDED_TODAY");
    }

    const last = await tx.attendance.findFirst({
      where: { employee_id: employee.id, check_out_at: { not: null } },
      orderBy: { check_out_at: "desc" },
      select: { check_out_at: true },
    });

    if (last && now.getTime() - last.check_out_at.getTime() < MIN_GAP_MS) {
      throw new ResponseError(409, "TOO_SOON");
    }

    const created = await tx.attendance.create({
      data: { employee_id: employee.id, check_in_at: now },
      select: { id: true, check_in_at: true },
    });

    return {
      type: "CHECK_IN",
      employee: { id: employee.id, name: employee.name },
      at: created.check_in_at,
    };
  });
};

const checkOut = async (request) => {
  const req = validate(attendValidation, request.body ?? {});

  await assertNetworkAllowed(request.ip);
  const employee = await authenticate(req.employee_id, req.pin);

  return withEmployeeLock(employee.id, async (tx) => {
    const now = new Date();
    const open = await findOpen(tx, employee.id);

    if (!open || wibDay(open.check_in_at) !== wibDay(now)) {
      throw new ResponseError(409, "NOT_CHECKED_IN");
    }
    if (now.getTime() - open.check_in_at.getTime() < MIN_GAP_MS) {
      throw new ResponseError(409, "TOO_SOON");
    }

    await tx.attendance.update({
      where: { id: open.id },
      data: { check_out_at: now },
    });

    return {
      type: "CHECK_OUT",
      employee: { id: employee.id, name: employee.name },
      at: now,
      check_in_at: open.check_in_at,
      duration_minutes: Math.floor((now - open.check_in_at) / 60000),
    };
  });
};

const myIp = (request) => {
  const info = describeIp(request.ip);

  if (!info) {
    throw new ResponseError(500, "IP_NOT_DETECTED");
  }

  return info;
};

const getToday = async (request) => {
  await assertNetworkAllowed(request.ip);

  const today = wibDay(new Date());
  const dayStart = new Date(`${today}T00:00:00+07:00`);
  const dayEnd = new Date(dayStart.getTime() + DAY_MS);

  const employees = await prisma.employee.findMany({
    where: {
      is_active: true,
      pin_hash: { not: null },
      OR: [{ email_verified_at: { not: null } }, { user_id: { not: null } }],
    },
    select: {
      id: true,
      name: true,
      attendances: {
        where: { check_in_at: { gte: dayStart, lt: dayEnd } },
        orderBy: { check_in_at: "desc" },
        take: 1,
        select: { check_in_at: true, check_out_at: true },
      },
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });

  const summary = { total: employees.length, working: 0, done: 0, not_yet: 0 };

  const list = employees.map(({ attendances, ...employee }) => {
    const attendance = attendances[0];

    let status = "NOT_YET";
    if (attendance?.check_out_at) status = "DONE";
    else if (attendance) status = "WORKING";

    summary[status.toLowerCase()]++;

    return {
      id: employee.id,
      name: employee.name,
      status,
      check_in_at: attendance?.check_in_at ?? null,
      check_out_at: attendance?.check_out_at ?? null,
    };
  });

  return { date: today, summary, employees: list };
};

export default { getEmployees, getToday, checkIn, checkOut, myIp };
