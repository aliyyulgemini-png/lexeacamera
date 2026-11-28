-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ScheduleRequestFormStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "ScheduleRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "schedules" ADD COLUMN     "status" "ScheduleStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE "schedule_request_forms" (
    "id" TEXT NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "max_days_per_employee" INTEGER,
    "allowed_item_ids" TEXT[],
    "employee_ids" TEXT[],
    "closes_at" TIMESTAMP(3),
    "status" "ScheduleRequestFormStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_request_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_requests" (
    "id" TEXT NOT NULL,
    "form_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "schedule_item_id" TEXT NOT NULL,
    "note" VARCHAR(500),
    "status" "ScheduleRequestStatus" NOT NULL DEFAULT 'PENDING',
    "owner_note" VARCHAR(500),
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "special_dates" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "color" VARCHAR(7) NOT NULL DEFAULT '#E53935',
    "is_yearly" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "special_dates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "schedule_request_forms_month_key" ON "schedule_request_forms"("month");

-- CreateIndex
CREATE INDEX "schedule_requests_employee_id_idx" ON "schedule_requests"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_requests_form_id_employee_id_date_key" ON "schedule_requests"("form_id", "employee_id", "date");

-- CreateIndex
CREATE INDEX "special_dates_date_idx" ON "special_dates"("date");

-- AddForeignKey
ALTER TABLE "schedule_requests" ADD CONSTRAINT "schedule_requests_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "schedule_request_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_requests" ADD CONSTRAINT "schedule_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_requests" ADD CONSTRAINT "schedule_requests_schedule_item_id_fkey" FOREIGN KEY ("schedule_item_id") REFERENCES "schedule_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
