"use client";

import { useEffect, useState } from "react";
import {
  type ApprenticePortalProfile,
} from "@/features/apprentice-portal/domain/apprentice-profile";
import { calculateProgrammeWeek } from "@/features/apprentice-lifecycle/domain/programme-week";

type State = {
  profile: ApprenticePortalProfile;
  loading: boolean;
  error: string | null;
};

const EMPTY_LIVE_PROFILE: ApprenticePortalProfile = {
  accountId: "",
  apprenticeId: "",
  displayName: "Apprentice",
  initials: "AP",
  programmeName: "Programme",
  programmeYear: 1,
  programmeWeek: 1,
  employerName: "Employer TBC",
  employerContact: "Workplace contact TBC",
  mentorName: "Mentor TBC",
  mentorId: "contact-mentor-live",
  tutorName: "Tutor TBC",
  tutorId: "contact-tutor-live",
  plannedProgressPercent: 0,
  actualProgressPercent: 0,
  attendancePercent: 0,
  nextReviewDate: "",
  lastReviewDate: null,
  openActionCount: 0,
  collegeDays: "TBC",
  programmeStartDate: "",
  deliverySpine: "groups",
  standardVersion: null,
  cohortName: null,
};

function withElapsedProgrammeWeek(
  profile: ApprenticePortalProfile,
): ApprenticePortalProfile {
  if (!profile.programmeStartDate) return profile;
  const elapsed = calculateProgrammeWeek(profile.programmeStartDate);
  if (elapsed == null) return profile;
  if (elapsed <= profile.programmeWeek) return profile;
  return { ...profile, programmeWeek: elapsed };
}

/**
 * Live apprentice identity for portal screens.
 * Loads from the DB via /api/apprentice/me for the signed-in environment.
 */
export function useApprenticePortalProfile(): State {
  const [state, setState] = useState<State>({
    profile: EMPTY_LIVE_PROFILE,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    void fetch("/api/apprentice/me")
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as {
          profile?: ApprenticePortalProfile;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !body.profile) {
          setState({
            profile: EMPTY_LIVE_PROFILE,
            loading: false,
            error: body.error || "Unable to load apprentice profile.",
          });
          return;
        }
        setState({
          profile: withElapsedProgrammeWeek(body.profile),
          loading: false,
          error: null,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({
          profile: EMPTY_LIVE_PROFILE,
          loading: false,
          error:
            err instanceof Error
              ? err.message
              : "Unable to load apprentice profile.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
