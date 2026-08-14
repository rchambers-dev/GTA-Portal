"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ApprenticePageShell,
} from "@/features/apprentice-portal/components/ApprenticePageShell";
import { Select } from "@/components/ui/Select";
import styles from "./programme-delivery.module.css";

type TeachingGroupOption = {
  id: string;
  name: string;
  tutorName: string;
  collegeDays: string;
  apprenticeCount: number;
  programmeVersionId: string | null;
};

/**
 * Tutor landing: pick a teaching group, open Session learning release.
 * Tasks stay separate. Attendance is not on this page.
 */
export function TutorProgrammeDeliveryScreen() {
  const [groups, setGroups] = useState<TeachingGroupOption[]>([]);
  const [groupId, setGroupId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/delivery/teaching-groups")
      .then(async (res) => {
        const json = (await res.json()) as {
          ok: boolean;
          teachingGroups?: TeachingGroupOption[];
          error?: string;
        };
        if (cancelled) return;
        if (!json.ok) {
          setError(json.error || "Could not load teaching groups.");
          setLoading(false);
          return;
        }
        const rows = json.teachingGroups || [];
        setGroups(rows);
        setGroupId((prev) => prev || rows[0]?.id || "");
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Could not load teaching groups.",
        );
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = groups.find((g) => g.id === groupId) ?? groups[0] ?? null;
  const blockHref = (block: 1 | 2) => {
    const path =
      block === 1
        ? "/staff/programme-delivery/block1"
        : "/staff/programme-delivery/block2";
    if (!selected?.id) return path;
    return `${path}?group=${encodeURIComponent(selected.id)}`;
  };

  return (
    <ApprenticePageShell
      eyebrow="Tutor"
      title="Programme delivery"
      description="Choose your teaching group, open the planned Session, then release the approved learning to the group."
    >
      <div className={styles.root}>
        <div className={styles.purpose}>
          <h2 className={styles.purposeLabel}>What to do here</h2>
          <ol className={styles.steps}>
            <li>Choose the teaching group you are delivering to.</li>
            <li>Open the Block and the planned Session.</li>
            <li>
              Use your tutor materials, then release the approved learner
              learning to the group in one action.
            </li>
          </ol>
          <p className={styles.purposeNote}>
            Releasing learning makes the approved Session available to the
            selected apprentices. It does <strong>not</strong> record
            attendance, complete a Task, or mark anyone competent.
          </p>
          {loading ? (
            <p className={styles.blockMeta}>Loading teaching groups…</p>
          ) : (
            <label
              className={styles.blockMeta}
              style={{ display: "grid", gap: 6 }}
            >
              <span>Teaching group</span>
              <Select
                value={selected?.id || ""}
                onChange={setGroupId}
                options={
                  groups.length === 0
                    ? [{ value: "", label: "No teaching group assigned" }]
                    : groups.map((g) => ({
                        value: g.id,
                        label: `${g.name} · ${g.apprenticeCount} apprentice${
                          g.apprenticeCount === 1 ? "" : "s"
                        }`,
                      }))
                }
              />
            </label>
          )}
          {error ? (
            <p className={styles.purposeNote} role="alert">
              {error}
            </p>
          ) : null}
          {selected ? (
            <p className={styles.purposeLead}>
              <strong>{selected.name}</strong>
              {selected.collegeDays ? ` · ${selected.collegeDays}` : ""}
              {` · ${selected.apprenticeCount} apprentice${
                selected.apprenticeCount === 1 ? "" : "s"
              }`}
            </p>
          ) : !loading ? (
            <p className={styles.purposeBody}>
              No teaching group is assigned to you. Ask a manager to place you
              on a teaching group before releasing learning.
            </p>
          ) : null}
        </div>

        {!selected ? (
          <p className={styles.empty}>Choose a teaching group to continue.</p>
        ) : (
          <div className={styles.actionGrid}>
            <article className={styles.actionCard}>
              <p className={styles.purposeLabel}>Block 1</p>
              <h2 className={styles.blockTitle}>Weeks 1–10</h2>
              <p className={styles.blockMeta}>
                Foundation skills Sessions. Open the Session, use the tutor
                materials, then release learning to the group.
              </p>
              <Link href={blockHref(1)} className={styles.primaryBtn}>
                Open Block 1 Sessions
              </Link>
            </article>
            <article className={styles.actionCard}>
              <p className={styles.purposeLabel}>Block 2</p>
              <h2 className={styles.blockTitle}>Weeks 11–20</h2>
              <p className={styles.blockMeta}>
                Later Sessions. Learners can only open these when the Block
                window is open, even if you have already released them.
              </p>
              <Link href={blockHref(2)} className={styles.primaryBtn}>
                Open Block 2 Sessions
              </Link>
            </article>
          </div>
        )}

        <p className={styles.empty}>
          Tasks stay separate. Releasing a Session does not release a Task.
          Attendance is recorded on the register, not here.
        </p>
      </div>
    </ApprenticePageShell>
  );
}
