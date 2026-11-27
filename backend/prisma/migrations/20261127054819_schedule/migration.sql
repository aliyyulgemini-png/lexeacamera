-- CreateEnum
CREATE TYPE "ScheduleItemCategory" AS ENUM ('SHIFT', 'LEAVE', 'OFF', 'OTHER');

-- CreateTable
CREATE TABLE "schedule_items" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "category" "ScheduleItemCategory" NOT NULL DEFAULT 'SHIFT',
    "start_time" VARCHAR(5),
    "end_time" VARCHAR(5),
    "color" VARCHAR(7) NOT NULL DEFAULT '#FFFFFF',
    "text_color" VARCHAR(7) NOT NULL DEFAULT '#000000',
    "show_in_summary" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedules" (
    "id" TEXT NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_employees" (
    "id" TEXT NOT NULL,
    "schedule_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_entries" (
    "id" TEXT NOT NULL,
    "schedule_employee_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "schedule_item_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "schedule_items_code_key" ON "schedule_items"("code");

-- CreateIndex
CREATE UNIQUE INDEX "schedules_month_key" ON "schedules"("month");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_employees_schedule_id_employee_id_key" ON "schedule_employees"("schedule_id", "employee_id");

-- CreateIndex
CREATE INDEX "schedule_entries_schedule_item_id_idx" ON "schedule_entries"("schedule_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_entries_schedule_employee_id_date_key" ON "schedule_entries"("schedule_employee_id", "date");

-- AddForeignKey
ALTER TABLE "schedule_employees" ADD CONSTRAINT "schedule_employees_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_employees" ADD CONSTRAINT "schedule_employees_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_entries" ADD CONSTRAINT "schedule_entries_schedule_employee_id_fkey" FOREIGN KEY ("schedule_employee_id") REFERENCES "schedule_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_entries" ADD CONSTRAINT "schedule_entries_schedule_item_id_fkey" FOREIGN KEY ("schedule_item_id") REFERENCES "schedule_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
