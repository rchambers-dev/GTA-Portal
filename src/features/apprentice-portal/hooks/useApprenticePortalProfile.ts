"use client";

import { useEffect, useState } from "react";
import {
  ALEX_PROFILE,
  type ApprenticePortalProfile,
} from "@/features/apprentice-portal/domain/mock-apprentice";
import { calculateProgrammeWeek } from "@/features/apprentice-lifecycle/domain/programme-week";

type State = {
  profile: ApprenticePortalProfile;
  loading: boolean;
  error: string | null;
  /** True when profile came from /api/apprentice/me */
  live: boolean;
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
  // Avoid "today" as a fake start — that skews block dates into the future.
  programmeStartDate: "",
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

/** Client: treat portal as live unless fiction demo is explicitly enabled. */
export function isLivePortalClient(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE !== "true";
}

/**
 * Live apprentice identity for portal screens.
 * Loads from the DB via /api/apprentice/me for the signed-in environment.
 * Fiction mode (NEXT_PUBLIC_DEMO_MODE=true) keeps the seeded Alex profile.
 */
export function useApprenticePortalProfile(): State {
  const liveMode = isLivePortalClient();
  const [state, setState] = useState<State>(() =>
    liveMode
      ? {
          profile: EMPTY_LIVE_PROFILE,
          loading: true,
          error: null,
          live: true,
        }
      : {
          profile: ALEX_PROFILE,
          loading: false,
          error: null,
          live: false,
        },
  );

  useEffect(() => {
    if (!liveMode) {
      setState({
        profile: ALEX_PROFILE,
        loading: false,
        error: null,
        live: false,
      });
      return;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null, live: true }));

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
            live: true,
          });
          return;
        }
        setState({
          profile: withElapsedProgrammeWeek(body.profile),
          loading: false,
          error: null,
          live: true,
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
          live: true,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [liveMode]);

  return state;
}
