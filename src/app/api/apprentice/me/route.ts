import { NextResponse } from "next/server";
import { getStandalonePorts } from "@/adapters/standalone";
import { createSupabaseAdminClient } from "@/adapters/supabase/client";
import {
  calculateProgrammeWeek,
  calculateProgrammeYear,
} from "@/features/apprentice-lifecycle/domain/programme-week";
import { resolveApprenticeDeliveryContext } from "@/features/apprentice-portal/domain/delivery-spine";
import type { ApprenticePortalProfile } from "@/features/apprentice-portal/domain/apprentice-profile";

function initialsFromName(name: string): string {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "AP";
}

function programmeLabel(name: string, standardCode: string | null): string {
  const code = standardCode?.trim();
  if (!code) return name;
  if (name.includes(code)) return name;
  return `${name} · ${code}`;
}

export async function GET() {
  const session = await getStandalonePorts().auth.getEffectiveSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const linkedId = session.account.linkedApprenticeId?.trim();
  if (!linkedId) {
    return NextResponse.json(
      {
        error:
          "This login is not linked to an apprentice record. Ask staff to enable the portal environment from the apprentice pack.",
      },
      { status: 404 },
    );
  }

  const supabase = createSupabaseAdminClient();

  const { data: apprentice, error: apprenticeError } = await supabase
    .from("apprentices")
    .select("id, display_name, email, apprentice_reference")
    .eq("id", linkedId)
    .maybeSingle();

  if (apprenticeError || !apprentice) {
    return NextResponse.json(
      { error: apprenticeError?.message ?? "Apprentice record not found." },
      { status: 404 },
    );
  }

  const { data: enrolment, error: enrolmentError } = await supabase
    .from("apprentice_programmes")
    .select(
      "id, programme_name, standard_code, employer_name, workplace_contact, mentor_name, tutor_name, college_days, start_date, programme_year, programme_week, attendance_percent, actual_progress_percent, original_planned_end_date, status",
    )
    .eq("apprentice_id", linkedId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (enrolmentError) {
    return NextResponse.json({ error: enrolmentError.message }, { status: 500 });
  }

  const displayName =
    apprentice.display_name?.trim() ||
    session.account.name ||
    apprentice.email ||
    "Apprentice";

  const startDate = enrolment?.start_date || new Date().toISOString().slice(0, 10);
  const computedWeek = calculateProgrammeWeek(startDate);
  const storedWeek =
    typeof enrolment?.programme_week === "number" && enrolment.programme_week > 0
      ? enrolment.programme_week
      : null;
  // Prefer elapsed week from start date when the apprentice has started.
  const programmeWeek =
    computedWeek ?? storedWeek ?? 1;
  const programmeYear = (calculateProgrammeYear(programmeWeek) ??
    enrolment?.programme_year ??
    1) as 1 | 2 | 3;

  const plannedEnd = enrolment?.original_planned_end_date
    ? new Date(`${enrolment.original_planned_end_date}T12:00:00Z`)
    : null;
  const start = new Date(`${startDate}T12:00:00Z`);
  let plannedProgressPercent = 0;
  if (plannedEnd && !Number.isNaN(plannedEnd.getTime()) && plannedEnd > start) {
    const total = plannedEnd.getTime() - start.getTime();
    const elapsed = Date.now() - start.getTime();
    plannedProgressPercent = Math.max(
      0,
      Math.min(100, Math.round((elapsed / total) * 100)),
    );
  }

  const delivery = await resolveApprenticeDeliveryContext(apprentice.id);

  const profile: ApprenticePortalProfile = {
    accountId: session.account.id,
    apprenticeId: apprentice.id,
    displayName,
    initials: initialsFromName(displayName),
    programmeName: programmeLabel(
      enrolment?.programme_name?.trim() || "Programme",
      enrolment?.standard_code ?? null,
    ),
    programmeYear,
    programmeWeek,
    employerName: enrolment?.employer_name?.trim() || "Employer TBC",
    employerContact:
      enrolment?.workplace_contact?.trim() ||
      enrolment?.mentor_name?.trim() ||
      "Workplace contact TBC",
    mentorName: enrolment?.mentor_name?.trim() || "Mentor TBC",
    mentorId: "contact-mentor-live",
    tutorName: enrolment?.tutor_name?.trim() || "Tutor TBC",
    tutorId: "contact-tutor-live",
    plannedProgressPercent,
    actualProgressPercent:
      typeof enrolment?.actual_progress_percent === "number"
        ? enrolment.actual_progress_percent
        : 0,
    attendancePercent:
      typeof enrolment?.attendance_percent === "number"
        ? enrolment.attendance_percent
        : 0,
    nextReviewDate: "",
    lastReviewDate: null,
    openActionCount: 0,
    collegeDays: enrolment?.college_days?.trim() || "TBC",
    programmeStartDate: startDate,
    standardCode: enrolment?.standard_code?.trim() || null,
    standardVersion: delivery.standardVersion,
    deliverySpine: delivery.deliverySpine,
    cohortName: delivery.cohortName,
  };

  return NextResponse.json({
    profile,
    enrolmentId: enrolment?.id ?? null,
    enrolmentStatus: enrolment?.status ?? null,
  });
}
