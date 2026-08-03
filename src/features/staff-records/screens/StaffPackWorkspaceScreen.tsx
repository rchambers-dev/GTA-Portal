"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAdminStore } from "@/features/administration/hooks/useAdminStore";
import { useDemoSession } from "@/shell/demo/DemoSessionProvider";
import {
  STAFF_EMPLOYMENT_FORM_CODE,
  STAFF_EMPLOYMENT_FORM_TITLE,
} from "../domain/staff-employment-checklist";
import {
  buildStaffDocRows,
  isStaffDocAttention,
  isStaffDocGap,
  staffDocStatusLabel,
  subscribeStaffPackStore,
  getStaffPackSnapshot,
  upsertStaffDocItem,
  type StaffDocRow,
  type StaffDocStatus,
} from "../domain/staff-pack-store";
import styles from "./StaffPackWorkspaceScreen.module.css";

type Props = {
  staffId: string;
  fromContext?: string;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function formatWorkspace(workspace: string): string {
  if (!workspace) return "—";
  return workspace.charAt(0).toUpperCase() + workspace.slice(1);
}

function statusTone(
  status: StaffDocStatus,
): "checked" | "missing" | "review" | "neutral" {
  switch (status) {
    case "checked_and_accepted":
      return "checked";
    case "missing":
    case "expired":
      return "missing";
    case "requested":
    case "received":
      return "review";
    default:
      return "neutral";
  }
}

function groupBySection(rows: StaffDocRow[]) {
  const order: string[] = [];
  const map = new Map<string, { sectionKey: string; sectionTitle: string; rows: StaffDocRow[] }>();
  for (const row of rows) {
    let group = map.get(row.sectionKey);
    if (!group) {
      group = {
        sectionKey: row.sectionKey,
        sectionTitle: row.sectionTitle,
        rows: [],
      };
      map.set(row.sectionKey, group);
      order.push(row.sectionKey);
    }
    group.rows.push(row);
  }
  return order.map((key) => map.get(key)!);
}

/**
 * Staff employment file — parallel to the apprentice ADM14 pack.
 * Checklist is assumed until the real form is confirmed.
 */
export function StaffPackWorkspaceScreen({
  staffId,
  fromContext = "management",
}: Props) {
  const store = useAdminStore();
  const { session } = useDemoSession();
  const staff = store.users.find((u) => u.id === staffId) ?? null;

  const packVersion = useSyncExternalStore(
    subscribeStaffPackStore,
    () => JSON.stringify(getStaffPackSnapshot().byStaff[staffId] ?? {}),
    () => "",
  );

  const rows = useMemo(() => {
    void packVersion;
    return buildStaffDocRows(staffId);
  }, [packVersion, staffId]);

  const sections = useMemo(() => groupBySection(rows), [rows]);

  const defaultSectionKey = useMemo(() => {
    const withGap = sections.find((s) => s.rows.some(isStaffDocGap));
    if (withGap) return withGap.sectionKey;
    return sections[0]?.sectionKey ?? "";
  }, [sections]);

  const [activeSectionKey, setActiveSectionKey] = useState(defaultSectionKey);
  const [editingId, setEditingId] = useState<string | null>(null);

  const activeSection =
    sections.find((s) => s.sectionKey === activeSectionKey) ?? sections[0];

  const totals = useMemo(() => {
    const critical = rows.filter(isStaffDocGap).length;
    const attention = rows.filter(isStaffDocAttention).length;
    const checked = rows.filter(
      (r) => r.status === "checked_and_accepted",
    ).length;
    return { critical, attention, checked, total: rows.length };
  }, [rows]);

  const returnHref =
    fromContext === "administration"
      ? "/staff-records?from=administration"
      : "/staff-records?from=management";

  if (!staff) {
    return (
      <div className={styles.root}>
        <Link href={returnHref} className={styles.backLink}>
          ← Back to Staff
        </Link>
        <p className={styles.missing}>Staff member not found.</p>
      </div>
    );
  }

  function markStatus(row: StaffDocRow, status: StaffDocStatus) {
    const stamp = new Date().toISOString().slice(0, 10);
    upsertStaffDocItem(staffId, row.reference, {
      status,
      checkedBy:
        status === "checked_and_accepted" ? session.account.name : row.checkedBy ?? "",
      dateChecked: status === "checked_and_accepted" ? stamp : row.dateChecked ?? "",
      dateReceived:
        status === "received" || status === "checked_and_accepted"
          ? row.dateReceived || stamp
          : row.dateReceived ?? "",
    });
  }

  return (
    <div className={styles.root}>
      <Link href={returnHref} className={styles.backLink}>
        ← Back to Staff
      </Link>

      <header className={styles.banner}>
        <div className={styles.bannerTop}>
          <div>
            <p className={styles.formEyebrow}>
              {STAFF_EMPLOYMENT_FORM_CODE} · {STAFF_EMPLOYMENT_FORM_TITLE}
            </p>
            <div className={styles.hero}>
              <div className={styles.avatar} aria-hidden>
                {initials(staff.displayName)}
              </div>
              <div>
                <h1 className={styles.title}>{staff.displayName}</h1>
                <p className={styles.sub}>
                  {staff.role} · {formatWorkspace(staff.workspace)}
                </p>
              </div>
            </div>
          </div>
          <StatusBadge
            tone={totals.critical > 0 ? "missing" : "checked"}
            size="md"
          >
            {totals.critical > 0
              ? `${totals.critical} mandatory missing`
              : "File complete"}
          </StatusBadge>
        </div>

        <div className={styles.facts}>
          <div>
            <span className={styles.factLabel}>Email</span>
            <span className={styles.factValue}>{staff.email}</span>
          </div>
          <div>
            <span className={styles.factLabel}>Environment</span>
            <span className={styles.factValue}>
              {staff.status === "invited"
                ? "Awaiting enable"
                : staff.status === "active"
                  ? "Enabled"
                  : "Disabled"}
            </span>
          </div>
          <div>
            <span className={styles.factLabel}>Enabled by</span>
            <span className={styles.factValue}>{staff.enabledBy ?? "—"}</span>
          </div>
        </div>

        <p className={styles.assumptionNote}>
          Assumed checklist — replace with the real GTA staff employment form
          once confirmed.
        </p>

        <div className={styles.pulse} aria-label="File status summary">
          <div
            className={
              totals.critical > 0 ? styles.pulseCritical : styles.pulseQuiet
            }
          >
            <strong>{totals.critical}</strong>
            <span>Mandatory missing</span>
          </div>
          <div
            className={
              totals.attention > 0 ? styles.pulseAttention : styles.pulseQuiet
            }
          >
            <strong>{totals.attention}</strong>
            <span>Needs attention</span>
          </div>
          <div className={styles.pulseOk}>
            <strong>{totals.checked}</strong>
            <span>Checked</span>
          </div>
          <div className={styles.pulseTotal}>
            <strong>{totals.total}</strong>
            <span>Total</span>
          </div>
        </div>
      </header>

      <div className={styles.layout}>
        <nav className={styles.sectionNav} aria-label="File sections">
          {sections.map((section) => {
            const gaps = section.rows.filter(isStaffDocGap).length;
            return (
              <button
                key={section.sectionKey}
                type="button"
                className={
                  section.sectionKey === activeSection?.sectionKey
                    ? styles.sectionNavActive
                    : styles.sectionNavBtn
                }
                onClick={() => setActiveSectionKey(section.sectionKey)}
              >
                <span>{section.sectionTitle}</span>
                {gaps > 0 ? (
                  <span className={styles.sectionGap}>{gaps}</span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <section className={styles.sectionPanel}>
          <header className={styles.sectionHead}>
            <h2>{activeSection?.sectionTitle ?? "Documents"}</h2>
            <p>
              Mark each item as it arrives. Swap this list for the official
              form when you have it.
            </p>
          </header>

          <div className={styles.docList}>
            {activeSection?.rows.map((row) => (
              <article
                key={row.id}
                className={styles.docCard}
                data-gap={isStaffDocGap(row) ? "true" : undefined}
              >
                <div className={styles.docMain}>
                  <p className={styles.docRef}>{row.reference}</p>
                  <h3 className={styles.docTitle}>{row.title}</h3>
                  <p className={styles.docMeta}>
                    {row.requirementKind === "mandatory"
                      ? "Mandatory"
                      : "Conditional"}{" "}
                    · {row.applicability}
                  </p>
                  {row.checkedBy ? (
                    <p className={styles.docAudit}>
                      Checked by {row.checkedBy}
                      {row.dateChecked ? ` · ${row.dateChecked}` : ""}
                    </p>
                  ) : null}
                </div>
                <div className={styles.docActions}>
                  <StatusBadge tone={statusTone(row.status)}>
                    {staffDocStatusLabel(row.status)}
                  </StatusBadge>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={() =>
                      setEditingId((current) =>
                        current === row.id ? null : row.id,
                      )
                    }
                  >
                    {editingId === row.id ? "Close" : "Update"}
                  </button>
                </div>

                {editingId === row.id ? (
                  <div className={styles.editPanel}>
                    <p className={styles.editHint}>
                      Quick status — full evidence upload lands later.
                    </p>
                    <div className={styles.editActions}>
                      {(
                        [
                          "missing",
                          "requested",
                          "received",
                          "checked_and_accepted",
                          "not_applicable",
                        ] as StaffDocStatus[]
                      ).map((status) => (
                        <button
                          key={status}
                          type="button"
                          className={
                            row.status === status
                              ? styles.statusActive
                              : styles.statusBtn
                          }
                          onClick={() => {
                            markStatus(row, status);
                            setEditingId(null);
                          }}
                        >
                          {staffDocStatusLabel(status)}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
