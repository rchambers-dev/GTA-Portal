"use client";

import { useEffect, useState } from "react";
import type { PublishedDeliveryCatalogue } from "./published-delivery-catalogue";
import { emptyCatalogue } from "./published-delivery-catalogue";

type State = {
  catalogue: PublishedDeliveryCatalogue;
  loading: boolean;
  error: string | null;
};

/**
 * Load published delivery catalogue for an enrolment pin or explicit version id.
 */
export function usePublishedDeliveryCatalogue(args: {
  programmeVersionId?: string | null;
  apprenticeId?: string | null;
  enabled?: boolean;
}): State {
  const enabled = args.enabled !== false;
  const versionId = args.programmeVersionId?.trim() || "";
  const apprenticeId = args.apprenticeId?.trim() || "";

  const [state, setState] = useState<State>({
    catalogue: emptyCatalogue(
      "unpinned",
      "Waiting for programme version assignment…",
    ),
    loading: enabled,
    error: null,
  });

  useEffect(() => {
    if (!enabled) {
      setState({
        catalogue: emptyCatalogue("unpinned", "Delivery catalogue idle."),
        loading: false,
        error: null,
      });
      return;
    }

    if (!versionId && !apprenticeId) {
      setState({
        catalogue: emptyCatalogue(
          "unpinned",
          "No GTA programme version is assigned to this enrolment. Bind a programme version before college tasks can appear.",
        ),
        loading: false,
        error: null,
      });
      return;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    const qs = new URLSearchParams();
    if (versionId) qs.set("programmeVersionId", versionId);
    if (apprenticeId) qs.set("apprenticeId", apprenticeId);

    void fetch(`/api/delivery/catalogue?${qs.toString()}`)
      .then(async (res) => {
        const data = (await res.json()) as {
          ok: boolean;
          catalogue?: PublishedDeliveryCatalogue;
          error?: string;
        };
        if (cancelled) return;
        if (!data.ok || !data.catalogue) {
          setState({
            catalogue: emptyCatalogue(
              "version_missing",
              data.error || "Could not load delivery catalogue.",
              versionId || null,
            ),
            loading: false,
            error: data.error || "Could not load delivery catalogue.",
          });
          return;
        }
        setState({
          catalogue: data.catalogue,
          loading: false,
          error: null,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({
          catalogue: emptyCatalogue(
            "version_missing",
            err instanceof Error ? err.message : "Could not load delivery catalogue.",
            versionId || null,
          ),
          loading: false,
          error: err instanceof Error ? err.message : "Load failed",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, versionId, apprenticeId]);

  return state;
}
