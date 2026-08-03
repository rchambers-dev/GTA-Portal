"use client";

import { useEffect, useSyncExternalStore } from "react";
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

const EMPTY_STATE: State = {
  profile: EMPTY_LIVE_PROFILE,
  loading: true,
  error: null,
};

let shared: State = EMPTY_STATE;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function withElapsedProgrammeWeek(
  profile: ApprenticePortalProfile,
): ApprenticePortalProfile {
  if (!profile.programmeStartDate) return profile;
  const elapsed = calculateProgrammeWeek(profile.programmeStartDate);
  if (elapsed == null) return profile;
  if (elapsed <= profile.programmeWeek) return profile;
  return { ...profile, programmeWeek: elapsed };
}

function needsLoad(): boolean {
  if (inflight) return false;
  if (shared.profile.apprenticeId) return false;
  if (shared.error) return false;
  return true;
}

function loadProfile(): Promise<void> {
  if (!needsLoad()) return inflight ?? Promise.resolve();

  shared = { profile: shared.profile, loading: true, error: null };
  emit();

  inflight = fetch("/api/apprentice/me")
    .then(async (res) => {
      const body = (await res.json().catch(() => ({}))) as {
        profile?: ApprenticePortalProfile;
        error?: string;
      };
      if (!res.ok || !body.profile) {
        shared = {
          profile: EMPTY_LIVE_PROFILE,
          loading: false,
          error: body.error || "Unable to load apprentice profile.",
        };
        return;
      }
      shared = {
        profile: withElapsedProgrammeWeek(body.profile),
        loading: false,
        error: null,
      };
    })
    .catch((err) => {
      shared = {
        profile: EMPTY_LIVE_PROFILE,
        loading: false,
        error:
          err instanceof Error
            ? err.message
            : "Unable to load apprentice profile.",
      };
    })
    .finally(() => {
      inflight = null;
      emit();
    });

  return inflight;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): State {
  return shared;
}

function getServerSnapshot(): State {
  return EMPTY_STATE;
}

/**
 * Live apprentice identity for portal screens.
 * Shared across shell + screens so page switches do not re-hit /api/apprentice/me.
 */
export function useApprenticePortalProfile(): State {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    void loadProfile();
  }, []);

  return state;
}

/** Test helper — clear module cache between tests. */
export function __resetApprenticePortalProfileCacheForTests(): void {
  shared = EMPTY_STATE;
  inflight = null;
  emit();
}
