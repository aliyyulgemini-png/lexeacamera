"use client";

import { useParams } from "next/navigation.js";

import ScheduleReadonlyView from "../../../../../components/owner/schedule-readonly-view.jsx";

export default function AdminScheduleDetailPage() {
  const { id } = useParams();

  return <ScheduleReadonlyView id={id} />;
}
