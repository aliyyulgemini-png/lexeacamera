"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FiHome,
  FiCamera,
  FiTag,
  FiFileText,
  FiImage,
  FiUser,
  FiMenu,
  FiX,
  FiChevronDown,
  FiLogOut,
  FiBox,
  FiUsers,
} from "react-icons/fi";
import {
  MdFormatListBulleted,
  MdHighQuality,
  MdOutlineFactCheck,
  MdOutlineShoppingCart,
  MdOutlineStore,
  MdQrCode2,
  MdQrCodeScanner,
} from "react-icons/md";
import { BiMoney, BiStoreAlt } from "react-icons/bi";

import { useGetStore } from "../../app/features/store/hooks.js";
import Image from "next/image.js";
import { useGetCurrentUser } from "../../app/features/users/hooks.js";
import { useRouter } from "next/navigation.js";
import { useQueryClient } from "@tanstack/react-query";
import { useLogoutCurrentUser } from "../../app/features/users/hooks.js";
import { normalizeApiError } from "../../lib/api/errors.js";
import notify from "../../lib/notify.js";
import { GrSchedule, GrUserManager } from "react-icons/gr";
import { HiOutlineUserCircle } from "react-icons/hi";
import { LuUserRoundCheck } from "react-icons/lu";
import { TbReportSearch } from "react-icons/tb";
import { FaCashRegister } from "react-icons/fa";

/*
  Urutan menu mengikuti frekuensi pemakaian dan alur kerja:
  harian (penjualan) -> katalog -> tim -> pemasaran -> pengaturan.
  Item dengan `group` sama harus berurutan agar dikelompokkan benar.
*/
const navigation = [
  { label: "Dashboard", href: "/owner", icon: FiHome, group: null },

  // Penjualan: alur harian
  {
    label: "Pesanan",
    href: "/owner/orders",
    icon: MdOutlineShoppingCart,
    group: "Penjualan",
  },
  {
    label: "Invoice",
    href: "/owner/invoices",
    icon: FiFileText,
    group: "Penjualan",
  },
  {
    label: "Pelanggan",
    href: "/owner/customers",
    icon: FiUsers,
    group: "Penjualan",
  },
  {
    label: "Report",
    href: "/owner/reports",
    icon: TbReportSearch,
    group: "Penjualan",
  },

  // Katalog
  { label: "Produk", href: "/owner/cameras", icon: FiBox, group: "Katalog" },
  {
    label: "Kategori",
    href: "/owner/categories",
    icon: FiTag,
    group: "Katalog",
  },
  {
    label: "Quality Control",
    href: "/owner/quality-controls",
    icon: MdOutlineFactCheck,
    group: "Katalog",
  },

  // Tim
  {
    label: "Karyawan",
    href: "/owner/employees",
    icon: GrUserManager,
    group: "Tim",
  },
  {
    label: "Absensi",
    href: "/owner/attendances",
    icon: LuUserRoundCheck,
    group: "Tim",
  },
  {
    label: "QR Absensi",
    href: "/owner/qr-attendances",
    icon: MdQrCodeScanner,
    group: "Tim",
  },
  {
    label: "Admin",
    href: "/owner/admins",
    icon: HiOutlineUserCircle,
    group: "Tim",
  },
  {
    label: "Gaji",
    href: "/owner/payrolls",
    icon: BiMoney,
    group: "Tim",
  },
  {
    label: "Jadwal",
    href: "/owner/schedules",
    icon: GrSchedule,
    group: "Tim",
  },
  {
    label: "Form Jadwal",
    href: "/owner/schedule-request-forms",
    icon: MdFormatListBulleted,
    group: "Tim",
  },
  {
    label: "Kasir",
    href: "/owner/daily-reports",
    icon: FaCashRegister,
    group: "Tim",
  },

  // Toko online dan promosi
  {
    label: "Toko Online",
    href: "/owner/marketplaces",
    icon: BiStoreAlt,
    group: "Pemasaran",
  },
  {
    label: "Banner",
    href: "/owner/banners",
    icon: FiImage,
    group: "Pemasaran",
  },
  {
    label: "QR Code",
    href: "/owner/qr-code",
    icon: MdQrCode2,
    group: "Pemasaran",
  },

  // Pengaturan: paling jarang
  {
    label: "Toko",
    href: "/owner/store",
    icon: MdOutlineStore,
    group: "Pengaturan",
  },
];

// Kelompokkan item berurutan berdasarkan `group`.
// Item tanpa group (Dashboard) tampil tanpa judul.
const navigationGroups = navigation.reduce((groups, item) => {
  const last = groups[groups.length - 1];

  if (last && last.label === item.group) last.items.push(item);
  else groups.push({ label: item.group, items: [item] });

  return groups;
}, []);

const pageTitles = {
  "/owner": "Dashboard",
  "/owner/cameras": "Produk",
  "/owner/categories": "Kategori",
  "/owner/quality-controls": "Quality Control",
  "/owner/invoices": "Invoice",
  "/owner/daily-reports": "Kasir",
  "/owner/schedules": "Jadwal",
  "/owner/customers": "Pelanggan",
  "/owner/orders": "Pesanan",
  "/owner/marketplaces": "Toko Online",
  "/owner/qr-code": "QR Code",
  "/owner/banners": "Banner",
  "/owner/store": "Toko",
  "/owner/profile": "Edit Profil",
  "/owner/settings": "Pengaturan",
  "/owner/account": "Akun Saya",
  "/owner/reports": "Reports",
  "/owner/admins": "Tim Admin",
  "/owner/employees": "Karyawan",
  "/owner/attendances": "Absensi",
  "/owner/qr-attendances": "QR Absensi",
};

/* Hindari warning useLayoutEffect saat render di server */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

function isItemActive(item, pathname) {
  return item.href === "/owner"
    ? pathname === "/owner"
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/*
  Semua item punya tinggi yang sama (wrapper ikon selalu p-2), jadi
  perpindahan active tidak menggeser layout. Latar putih active adalah
  SATU indikator yang meluncur (transform + height), bukan background
  per item, sehingga animasinya ringan dan tidak lompat.
*/
function SidebarLink({ item, active, onClick, linkRef }) {
  const Icon = item.icon;

  return (
    <Link
      ref={linkRef}
      href={item.href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`group relative z-10 flex items-center gap-4 rounded-full px-2 py-1.5 text-sm font-medium transition-colors duration-300 motion-reduce:transition-none ${
        active ? "text-second" : "text-primary hover:bg-primary/20"
      }`}
    >
      <span className="relative flex shrink-0 items-center justify-center rounded-full p-2">
        <span
          aria-hidden="true"
          className={`absolute inset-0 rounded-full bg-grad transition-opacity duration-300 motion-reduce:transition-none ${
            active ? "opacity-100" : "opacity-0"
          }`}
        />
        <Icon size={19} className="relative text-primary" />
      </span>

      <span>{item.label}</span>
    </Link>
  );
}

function ProfileMenu({ onClose }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const logoutMutation = useLogoutCurrentUser();

  const items = [{ label: "Akun saya", href: "/owner/account", icon: FiUser }];

  async function handleLogout() {
    try {
      await logoutMutation.mutateAsync();

      // Hapus cache privat, termasuk data profil user dan toko.
      queryClient.clear();

      onClose();
      router.replace("/auth/login");
      router.refresh();

      notify.success("Berhasil keluar dari akun.");
    } catch (error) {
      const apiError = normalizeApiError(error);
      notify.error(apiError.message);
    }
  }

  return (
    <div
      id="admin-profile-menu"
      className="absolute bottom-full left-1/2 z-20 mb-2 w-[85%] -translate-x-1/2 overflow-hidden rounded-2xl  bg-second p-2 shadow-xl shadow-second/10"
    >
      <div className="  px-4 py-2">
        <p className="text-xs font-medium text-primary/40">Akun</p>
      </div>

      <div className="mt-1 flex flex-col gap-1">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className="flex items-center gap-4 rounded-xl px-4 py-2.5 text-sm text-primary/70 transition-colors hover:bg-second/5 hover:text-primary"
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={handleLogout}
          disabled={logoutMutation.isPending}
          className="flex w-full cursor-pointer items-center gap-4 rounded-xl bg-second2 px-4 py-2.5 text-left text-sm font-medium text-primary transition-colors hover:bg-second2/80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FiLogOut size={18} />
          <span>{logoutMutation.isPending ? "Keluar..." : "Keluar"}</span>
        </button>
      </div>
    </div>
  );
}

function Sidebar({ mobileOpen, onClose }) {
  const pathname = usePathname();
  const [profileOpen, setProfileOpen] = useState(false);
  const { data: store } = useGetStore();
  const { data: currentUser, isLoading: isUserLoading } = useGetCurrentUser();

  const linkRefs = useRef({});
  const [indicator, setIndicator] = useState({
    top: 0,
    height: 0,
    visible: false,
    animate: false,
  });

  const activeHref =
    navigation.find((item) => isItemActive(item, pathname))?.href ?? null;

  /* Ukur posisi item active, lalu geser indikator ke sana. */
  useIsomorphicLayoutEffect(() => {
    const element = activeHref ? linkRefs.current[activeHref] : null;

    if (!element) {
      setIndicator((prev) => ({ ...prev, visible: false }));
      return;
    }

    setIndicator((prev) => ({
      top: element.offsetTop,
      height: element.offsetHeight,
      visible: true,
      // Tampilan pertama langsung di posisi, tanpa meluncur dari atas.
      animate: prev.visible,
    }));
  }, [activeHref]);

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-64 flex-col   bg-grad transition-transform duration-300 ease-in-out lg:sticky lg:top-0 lg:translate-x-0 ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex h-16 shrink-0 items-center justify-between   px-4">
        <Link
          href="/owner"
          onClick={onClose}
          className="flex items-center gap-2"
        >
          <div className="flex size-8 items-center justify-center rounded-full overflow-hidden text-primary">
            {store ? (
              <Image
                src={store.logo_url}
                width={50}
                height={50}
                alt={`${store.name} logo`}
              ></Image>
            ) : (
              <FiCamera></FiCamera>
            )}
          </div>

          <span className="text-base font-bold tracking-tight text-primary">
            {`${store ? store.name : "Toko Anda"}`}{" "}
          </span>
        </Link>

        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup sidebar"
          className="rounded-lg p-2 text-primary transition-colors hover:bg-second/5 hover:text-second lg:hidden"
        >
          <FiX size={24} />
        </button>
      </div>

      <div className="sidebar-scroll flex-1 overflow-y-auto px-4 py-8">
        <nav
          aria-label="Navigasi owner"
          className="relative flex flex-col gap-4"
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute inset-x-0 top-0 rounded-full bg-primary will-change-transform motion-reduce:transition-none ${
              indicator.animate
                ? "transition-[transform,height,opacity] duration-300 ease-out"
                : ""
            } ${indicator.visible ? "opacity-100" : "opacity-0"}`}
            style={{
              height: indicator.height,
              transform: `translateY(${indicator.top}px)`,
            }}
          />

          {navigationGroups.map((group) => (
            <div
              key={group.label ?? "root"}
              role="group"
              aria-label={group.label ?? "Utama"}
              className="flex flex-col gap-2"
            >
              {group.label && (
                <div className="flex items-center gap-2 px-4 pt-2">
                  <p className="shrink-0 text-xs font-semibold uppercase tracking-wider text-primary/60">
                    {group.label}
                  </p>
                  <span
                    aria-hidden="true"
                    className="flex-1 border-t border-dashed border-primary/40"
                  />
                </div>
              )}

              {group.items.map((item) => (
                <SidebarLink
                  key={item.href}
                  item={item}
                  active={item.href === activeHref}
                  onClick={onClose}
                  linkRef={(node) => {
                    linkRefs.current[item.href] = node;
                  }}
                />
              ))}
            </div>
          ))}
        </nav>
      </div>

      <div className="relative shrink-0 p-4">
        {profileOpen && <ProfileMenu onClose={() => setProfileOpen(false)} />}

        <button
          type="button"
          aria-expanded={profileOpen}
          aria-controls="admin-profile-menu"
          onClick={() => setProfileOpen((open) => !open)}
          className={`flex w-full items-center gap-4 rounded-xl bg-primary p-2 text-left transition-colors ${
            profileOpen ? "bg-primary" : ""
          }`}
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-grad text-primary">
            <FiUser size={20} />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-second">
              {isUserLoading
                ? "Memuat akun..."
                : currentUser?.name || "Akun Saya"}
            </p>

            <p className="truncate text-xs text-second/50">
              {currentUser?.email || ""}
            </p>
          </div>

          <FiChevronDown
            size={17}
            className={`shrink-0 text-second/40 transition-transform ${
              profileOpen ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>
    </aside>
  );
}

export default function OwnerShell({ children }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const pageTitle =
    pageTitles[pathname] ||
    navigation.find(
      (item) => item.href !== "/owner" && pathname.startsWith(`${item.href}/`),
    )?.label ||
    "Admin";

  function closeMobileSidebar() {
    setMobileOpen(false);
  }

  return (
    <div className="min-h-dvh bg-primary text-second">
      {mobileOpen && (
        <button
          type="button"
          aria-label="Tutup menu navigasi"
          onClick={closeMobileSidebar}
          className="fixed inset-0 z-40 bg-second/40 backdrop-blur-md lg:hidden"
        />
      )}

      <div className="flex min-h-dvh">
        <Sidebar mobileOpen={mobileOpen} onClose={closeMobileSidebar} />

        <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-4   px-4 text-second bg-primary sm:px-8">
            <button
              type="button"
              aria-label="Buka menu navigasi"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-second transition-colors hover:bg-primary/10 lg:hidden"
            >
              <FiMenu size={21} />
            </button>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-semibold sm:text-lg">
                {pageTitle}
              </h1>
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
