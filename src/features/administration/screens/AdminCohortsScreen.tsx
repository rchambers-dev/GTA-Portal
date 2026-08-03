"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "@/features/apprentice-portal/components/ApprenticePageShell";
import { usePortalSession } from "@/shell/session/PortalSessionProvider";
import {
  createCohort,
  updateCohort,
  lockCohortWithSessionLog,
  isCohortStarted,
  type CohortInput,
} from "../domain/store";
import type {
  AdminCohortRecord,
  AdminApprenticeEnrolment,
  AdminProgrammeRecord,
} from "../domain/types";
import { enrolmentKindLabel } from "../domain/enrolment-status";
import { Select } from "@/components/ui/Select";
import { useAdminStore } from "../hooks/useAdminStore";
import { CohortTeachersPicker } from "../components/CohortTeachersPicker";
import { CohortTeachingGroupsPanel } from "../components/CohortTeachingGroupsPanel";
import { cohortTeacherList } from "../domain/tutor-options";
import {
  formatCohortTeachers,
} from "../domain/cohort-teachers";
import {
  defaultProductForStandard,
  deliverySpineLabel,
  findProduct,
  formatCohortProductLabel,
  isCourseStandard,
  normalizeDeliverySpine,
  productById,
  productsForStandard,
  resolveProductId,
  type DeliverySpine,
} from "../domain/cohort-products";
import { plannedDatesFromStart } from "../domain/programme-duration";
import styles from "./admin-pages.module.css";

type FormState = CohortInput;

/** Above this many apprentices, the picker opens as a full container, not a dropdown. */
const APPRENTICE_MODAL_THRESHOLD = 5;

type CohortSearchMode = "name" | "programme" | "version" | "group";

const SEARCH_MODES: Array<{
  id: CohortSearchMode;
  label: string;
  placeholder: string;
}> = [
  { id: "name", label: "Name", placeholder: "Search by cohort name…" },
  {
    id: "programme",
    label: "Programme",
    placeholder: "Search by programme or standard code…",
  },
  { id: "version", label: "Version", placeholder: "Search by version or spine, e.g. 1.3 or groups…" },
  {
    id: "group",
    label: "Group",
    placeholder: "Search by teaching group…",
  },
];

function emptyForm(programme?: AdminProgrammeRecord): FormState {
  const defaultProduct = defaultProductForStandard(programme?.standardCode);
  return {
    name: "",
    programmeId: programme?.id ?? "",
    programmeName: programme?.name ?? "",
    standardCode: programme?.standardCode ?? "",
    standardVersion: defaultProduct?.standardVersion ?? "1.0",
    deliverySpine: defaultProduct?.deliverySpine ?? "groups",
    enrolmentOpensDate: "",
    startDate: "",
    expectedEndDate: "",
    teachingGroup: "",
    collegeDays: "",
    teacherNames: [],
    status: "planned",
    notes: "",
  };
}

/** "Autocare Level 2" → "Autocare L2" */
function programmeShortLabel(name: string): string {
  return name
    .replace(/\bLevel\s+(\d+)\b/gi, "L$1")
    .replace(/\s+/g, " ")
    .trim();
}

const INTAKE_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sept",
  "Oct",
  "Nov",
  "Dec",
] as const;

function formatIntakeMonthYear(isoDate: string): string | null {
  const match = /^(\d{4})-(\d{2})/.exec(isoDate);
  if (!match) return null;
  const year = match[1];
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) return null;
  return `${INTAKE_MONTHS[monthIndex]} ${year}`;
}

function formatVersionLabel(version: string): string | null {
  const trimmed = version.trim().replace(/^v/i, "");
  if (!trimmed) return null;
  return `v${trimmed}`;
}

/**
 * e.g. Autocare L2 (ST0499) · v1.3 · Groups · Dec 2025–Jun 2028
 * (Teachers, groups and college days live under the intake — not in the name.)
 */
function buildCohortName(input: {
  programmeName: string;
  standardCode?: string;
  standardVersion?: string;
  deliverySpine?: DeliverySpine | string;
  startDate: string;
  expectedEndDate?: string;
}): string {
  const programme = programmeShortLabel(input.programmeName);
  const when = formatIntakeMonthYear(input.startDate);
  if (!programme || !when) return "";

  const code = input.standardCode?.trim().toUpperCase() ?? "";
  const programmePart = code ? `${programme} (${code})` : programme;
  const parts = [programmePart];

  const product = formatCohortProductLabel(
    input.standardVersion ?? "",
    input.deliverySpine,
  );
  if (product) {
    parts.push(product);
  } else {
    const version = formatVersionLabel(input.standardVersion ?? "");
    if (version) parts.push(version);
  }

  const endWhen = input.expectedEndDate
    ? formatIntakeMonthYear(input.expectedEndDate)
    : null;
  parts.push(endWhen ? `${when}–${endWhen}` : when);

  return parts.join(" · ");
}

function autoNameFromForm(form: FormState): string {
  return buildCohortName({
    programmeName: form.programmeName,
    standardCode: form.standardCode,
    standardVersion: form.standardVersion,
    deliverySpine: form.deliverySpine,
    startDate: form.startDate,
    expectedEndDate: form.expectedEndDate,
  });
}

/** Cohort title without teacher / day / group suffixes. */
function cohortDisplayName(row: AdminCohortRecord): string {
  const auto = buildCohortName({
    programmeName: row.programmeName,
    standardCode: row.standardCode,
    standardVersion: row.standardVersion,
    deliverySpine: row.deliverySpine,
    startDate: row.startDate,
    expectedEndDate: row.expectedEndDate,
  });
  if (auto) return auto;
  return row.name;
}

function withAutoCohortName(
  prev: FormState,
  patch: Partial<FormState>,
  nameLocked: boolean,
): FormState {
  const next = { ...prev, ...patch };
  if (nameLocked) return next;
  const autoName = autoNameFromForm(next);
  if (autoName) next.name = autoName;
  return next;
}

/** Refresh name + expected end when programme or intake start changes. */
function withAutoCohortFields(
  prev: FormState,
  patch: Partial<FormState>,
  nameLocked: boolean,
  durationMonths: number | undefined,
): FormState {
  const next = { ...prev, ...patch };
  const refreshEnd =
    patch.startDate !== undefined || patch.programmeId !== undefined;
  if (refreshEnd) {
    const planned = plannedDatesFromStart(next.startDate, durationMonths);
    if (planned.practicalEndDate) {
      next.expectedEndDate = planned.practicalEndDate;
    }
  }
  if (!nameLocked) {
    const autoName = autoNameFromForm(next);
    if (autoName) next.name = autoName;
  }
  return next;
}

function apprenticesForCohort(
  enrolments: AdminApprenticeEnrolment[],
  cohortId: string,
): AdminApprenticeEnrolment[] {
  return enrolments
    .filter((e) => e.cohortId === cohortId)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

function formatDate(value: string): string {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function cohortMatchesQuery(
  row: AdminCohortRecord,
  query: string,
  mode: CohortSearchMode,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  switch (mode) {
    case "name":
      return q
        .split(/\s+/)
        .every((token) => row.name.toLowerCase().includes(token));
    case "programme":
      return (
        row.programmeName.toLowerCase().includes(q) ||
        row.standardCode.toLowerCase().includes(q.replace(/\s+/g, ""))
      );
    case "version": {
      const needle = q.replace(/^v/i, "");
      const product = formatCohortProductLabel(
        row.standardVersion,
        row.deliverySpine,
      ).toLowerCase();
      return (
        row.standardVersion.toLowerCase().includes(needle) ||
        product.includes(needle) ||
        deliverySpineLabel(normalizeDeliverySpine(row.deliverySpine))
          .toLowerCase()
          .includes(needle)
      );
    }
    case "group":
      return row.teachingGroup.toLowerCase().includes(q);
  }
}

function CohortInlineField({
  label,
  value,
  onCommit,
  type = "text",
  placeholder,
  wide = false,
  multiline = false,
  readOnly = false,
}: {
  label: string;
  value: string;
  onCommit: (next: string) => void;
  type?: "text" | "date";
  placeholder?: string;
  wide?: boolean;
  multiline?: boolean;
  readOnly?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setDraft(value);
  }

  function commit() {
    if (readOnly) return;
    if (draft.trim() !== value.trim()) onCommit(draft);
    else setDraft(value);
  }

  return (
    <label
      className={`${styles.detailField}${wide ? ` ${styles.detailFieldWide}` : ""}`}
    >
      <span className={styles.detailFieldLabel}>{label}</span>
      {multiline ? (
        <textarea
          className={styles.detailFieldInput}
          value={draft}
          placeholder={placeholder}
          rows={3}
          readOnly={readOnly}
          disabled={readOnly}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
        />
      ) : (
        <input
          className={styles.detailFieldInput}
          type={type}
          value={draft}
          placeholder={placeholder}
          readOnly={readOnly}
          disabled={readOnly}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
        />
      )}
    </label>
  );
}

export function AdminCohortsScreen() {
  const store = useAdminStore();
  const { session } = usePortalSession();
  const actorName =
    session?.account?.name?.trim() ||
    session?.account?.email?.trim() ||
    "Administrator";
  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState<CohortSearchMode>("name");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sessionEdits, setSessionEdits] = useState<string[]>([]);
  const sessionEditsRef = useRef<string[]>([]);
  const expandedIdRef = useRef<string | null>(null);
  const unlockedCohortIdRef = useRef<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [apprenticeMenuId, setApprenticeMenuId] = useState<string | null>(null);
  const [prevApprenticeMenuId, setPrevApprenticeMenuId] = useState<
    string | null
  >(null);
  const [apprenticeFilter, setApprenticeFilter] = useState("");
  const apprenticeMenuRef = useRef<HTMLDivElement | null>(null);
  const apprenticeModalRef = useRef<HTMLDivElement | null>(null);
  /** When true, programme/date changes no longer overwrite the cohort name. */
  const [nameLocked, setNameLocked] = useState(false);
  const programmes = store.programmes.filter((p) => p.status === "active");
  const [form, setForm] = useState<FormState>(() =>
    emptyForm(programmes[0]),
  );
  const selectedProgramme = programmes.find((p) => p.id === form.programmeId);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lockBusy, setLockBusy] = useState(false);

  const actorNameRef = useRef(actorName);
  useEffect(() => {
    actorNameRef.current = actorName;
  }, [actorName]);

  useEffect(() => {
    sessionEditsRef.current = sessionEdits;
  }, [sessionEdits]);

  useEffect(() => {
    expandedIdRef.current = expandedId;
  }, [expandedId]);

  useEffect(() => {
    function onBeforeUnload() {
      const unlockedId = unlockedCohortIdRef.current;
      if (!unlockedId) return;
      unlockedCohortIdRef.current = null;
      // Best-effort: keepalive POST so leave-lock still hits the API.
      try {
        const details = sessionEditsRef.current;
        const who = actorNameRef.current;
        const summary = details.length
          ? `${who} saved ${details.length} change${details.length === 1 ? "" : "s"}`
          : `${who} locked with no structural changes`;
        void fetch("/api/admin/store", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          keepalive: true,
          body: JSON.stringify({
            action: "lockCohortSession",
            id: unlockedId,
            summary,
            details,
            actorName: who,
          }),
        });
      } catch {
        /* ignore */
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      const unlockedId = unlockedCohortIdRef.current;
      unlockedCohortIdRef.current = null;
      if (!unlockedId) return;
      void lockCohortWithSessionLog(
        unlockedId,
        sessionEditsRef.current,
        actorNameRef.current,
      ).catch(() => {
        /* ignore on unmount */
      });
    };
  }, []);

  function recordSessionEdit(message: string) {
    setSessionEdits((prev) => {
      const next = [...prev, message];
      sessionEditsRef.current = next;
      return next;
    });
  }

  function describeCohortPatch(
    patch: Parameters<typeof updateCohort>[1],
  ): string | null {
    if (patch.locked != null && Object.keys(patch).length === 1) return null;
    if (patch.name != null) return `Name set to “${patch.name}”`;
    if (patch.standardVersion != null || patch.deliverySpine != null) {
      const version = patch.standardVersion ?? "(unchanged)";
      const spine =
        patch.deliverySpine != null
          ? deliverySpineLabel(normalizeDeliverySpine(patch.deliverySpine))
          : null;
      if (patch.standardVersion != null && spine) {
        return `Product set to ${formatCohortProductLabel(version, patch.deliverySpine)}`;
      }
      if (patch.standardVersion != null) {
        return `Standard version set to v${String(version).replace(/^v/i, "")}`;
      }
      return `Delivery spine set to ${spine}`;
    }
    if (patch.teacherNames != null) {
      return `Teachers updated (${patch.teacherNames.join(", ") || "none"})`;
    }
    if (patch.enrolmentOpensDate != null) {
      return `Enrolment opens ${patch.enrolmentOpensDate || "(cleared)"}`;
    }
    if (patch.startDate != null) return `Start date set to ${patch.startDate}`;
    if (patch.expectedEndDate != null) {
      return `Expected end set to ${patch.expectedEndDate || "(cleared)"}`;
    }
    if (patch.status != null) return `Status set to ${patch.status}`;
    if (patch.notes != null) return "Notes updated";
    return "Cohort details updated";
  }

  async function flushLockSession(
    cohortId: string,
    opts?: { quiet?: boolean },
  ) {
    setLockBusy(true);
    try {
      const edits = [...sessionEditsRef.current];
      await lockCohortWithSessionLog(cohortId, edits, actorName);
      setSessionEdits([]);
      sessionEditsRef.current = [];
      if (unlockedCohortIdRef.current === cohortId) {
        unlockedCohortIdRef.current = null;
      }
      if (!opts?.quiet) {
        setSuccess("Cohort locked. Session changes saved to history.");
        setError(null);
      }
    } catch (err) {
      if (!opts?.quiet) {
        setError(
          err instanceof Error ? err.message : "Unable to lock cohort.",
        );
      }
    } finally {
      setLockBusy(false);
    }
  }

  async function selectExpanded(nextId: string | null) {
    const current = expandedId;
    if (current && current !== nextId) {
      const currentRow = store.cohorts.find((c) => c.id === current);
      if (currentRow && currentRow.locked === false) {
        await flushLockSession(current, { quiet: true });
      }
      setSessionEdits([]);
      sessionEditsRef.current = [];
    }
    setExpandedId(nextId);
  }

  const filtered = useMemo(() => {
    const rows = [...store.cohorts].sort((a, b) =>
      b.startDate.localeCompare(a.startDate),
    );
    return rows.filter((row) => cohortMatchesQuery(row, query, searchMode));
  }, [query, searchMode, store.cohorts]);

  const totalCohorts = store.cohorts.length;
  const activeSearch = SEARCH_MODES.find((m) => m.id === searchMode)!;

  if (apprenticeMenuId !== prevApprenticeMenuId) {
    setPrevApprenticeMenuId(apprenticeMenuId);
    if (!apprenticeMenuId) {
      setApprenticeFilter("");
    }
  }

  useEffect(() => {
    if (!apprenticeMenuId) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      const inDropdown =
        apprenticeMenuRef.current?.contains(target) ?? false;
      const inModal = apprenticeModalRef.current?.contains(target) ?? false;
      if (!inDropdown && !inModal) setApprenticeMenuId(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setApprenticeMenuId(null);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [apprenticeMenuId]);

  /** One-time: drop legacy tutor names from stored cohort titles. */
  const namesSyncedRef = useRef(false);
  useEffect(() => {
    if (namesSyncedRef.current || store.cohorts.length === 0) return;
    namesSyncedRef.current = true;
    void (async () => {
      for (const row of store.cohorts) {
        const clean = cohortDisplayName(row);
        if (!clean || clean === row.name) continue;
        try {
          const wasLocked = row.locked !== false;
          if (wasLocked) {
            await updateCohort(row.id, { locked: false });
          }
          await updateCohort(row.id, {
            name: clean,
            ...(wasLocked ? { locked: true } : {}),
          });
        } catch {
          // Leave display-only clean name if persist fails.
        }
      }
    })();
  }, [store.cohorts]);

  function openCreate() {
    setEditingId(null);
    setNameLocked(false);
    setForm(emptyForm(programmes[0]));
    setError(null);
    setSuccess(null);
    setShowForm(true);
  }

  function openEdit(row: AdminCohortRecord) {
    if (row.locked !== false) {
      setError(
        "This cohort is locked. Unlock it first if you need to correct a detail.",
      );
      void selectExpanded(row.id);
      return;
    }
    setEditingId(row.id);
    setNameLocked(true);
    setForm({
      name: cohortDisplayName(row),
      programmeId: row.programmeId,
      programmeName: row.programmeName,
      standardCode: row.standardCode,
      standardVersion: row.standardVersion,
      deliverySpine: normalizeDeliverySpine(row.deliverySpine),
      enrolmentOpensDate: row.enrolmentOpensDate,
      startDate: row.startDate,
      expectedEndDate: row.expectedEndDate,
      teachingGroup: row.teachingGroup,
      collegeDays: row.collegeDays,
      teacherNames: cohortTeacherList(row),
      status: row.status,
      notes: row.notes,
    });
    setError(null);
    setSuccess(null);
    setShowForm(true);
    void selectExpanded(row.id);
  }

  async function patchCohort(
    cohortId: string,
    patch: Parameters<typeof updateCohort>[1],
  ) {
    setError(null);
    try {
      await updateCohort(cohortId, patch);
      if (patch.locked === false) {
        unlockedCohortIdRef.current = cohortId;
        setSessionEdits([]);
        sessionEditsRef.current = [];
        setSuccess("Cohort unlocked. Edit, then Save & lock when finished.");
      } else if (patch.locked === true) {
        unlockedCohortIdRef.current = null;
      } else {
        const line = describeCohortPatch(patch);
        if (line) recordSessionEdit(line);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update cohort.");
    }
  }

  function onProgrammeChange(programmeId: string) {
    const match = programmes.find((p) => p.id === programmeId);
    const nextCode = match?.standardCode ?? "";
    const defaultProduct = defaultProductForStandard(nextCode);
    setForm((prev) =>
      withAutoCohortFields(
        prev,
        {
          programmeId,
          programmeName: match?.name ?? prev.programmeName,
          standardCode: nextCode,
          ...(defaultProduct
            ? {
                standardVersion: defaultProduct.standardVersion,
                deliverySpine: defaultProduct.deliverySpine,
              }
            : {}),
        },
        nameLocked,
        match?.durationMonths,
      ),
    );
  }

  function buildInput(): CohortInput | null {
    if (!form.name.trim()) {
      setError("Cohort name is required.");
      return null;
    }
    if (!form.programmeId) {
      setError("Select a programme.");
      return null;
    }
    if (!form.standardVersion.trim()) {
      setError("Select a cohort product (version + delivery spine).");
      return null;
    }
    if (!form.deliverySpine) {
      setError("Delivery spine is required.");
      return null;
    }
    if (!form.startDate) {
      setError("Intake start date is required.");
      return null;
    }
    return {
      ...form,
      name: form.name.trim(),
      standardVersion: form.standardVersion.trim().replace(/^v/i, ""),
      deliverySpine: normalizeDeliverySpine(form.deliverySpine),
      teacherNames: form.teacherNames ?? [],
      tutorName: formatCohortTeachers(form.teacherNames ?? []),
    };
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const input = buildInput();
    if (!input) return;
    try {
      if (editingId) {
        await updateCohort(editingId, input);
        recordSessionEdit("Updated cohort via full edit form");
        setSuccess(`Updated ${input.name}.`);
        await selectExpanded(editingId);
      } else {
        const created = await createCohort(input);
        setSuccess(
          `Added cohort ${input.name}. It is locked — unlock to edit, then Save & lock.`,
        );
        await selectExpanded(created.id);
      }
      setShowForm(false);
      setEditingId(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save cohort. Try again.",
      );
    }
  }

  return (
    <ApprenticePageShell
      eyebrow="Administration"
      title="Cohorts & Groups"
      description="Set up intakes (programme version + dates), select tutors, then create each tutor’s teaching groups with college days and capacity. Place apprentices into a tutor’s group."
      actions={
        <button type="button" className={styles.primaryBtn} onClick={openCreate}>
          Add cohort
        </button>
      }
    >
      <div className={styles.stack}>
        {success ? <p className={styles.success}>{success}</p> : null}
        {error && !showForm ? <p className={styles.error}>{error}</p> : null}

        {showForm ? (
          <form className={styles.formStack} onSubmit={submit}>
            <section className={styles.formGroup}>
              <div className={styles.formGroupHead}>
                <h2 className={styles.formGroupTitle}>
                  {editingId ? "Edit cohort" : "Add cohort"}
                </h2>
                <span className={styles.formGroupBadge}>
                  {editingId ? "Existing intake" : "New intake"}
                </span>
              </div>
              <p className={styles.formGroupMeta}>
                Pick the Skills England pack and delivery spine together. Older
                cohorts stay on groups; new intakes can use the same pack on
                blocks. Both lock for the life of the intake.
              </p>

              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>
                    Programme{" "}
                    <em className={styles.fieldRequired}>required</em>
                  </span>
                  <Select
                    value={form.programmeId}
                    placeholder="Select programme…"
                    options={programmes.map((programme) => ({
                      value: programme.id,
                      label: `${programme.name} (${programme.standardCode})`,
                    }))}
                    onChange={onProgrammeChange}
                  />
                </label>
                {isCourseStandard(form.standardCode) ? (
                  <label className={styles.field}>
                    <span>
                      Cohort product{" "}
                      <em className={styles.fieldRequired}>required</em>
                    </span>
                    <Select
                      value={resolveProductId(
                        form.standardCode,
                        form.standardVersion,
                        form.deliverySpine,
                      )}
                      placeholder="Select version + spine…"
                      options={productsForStandard(form.standardCode, {
                        includeFinishers: true,
                      }).map((product) => ({
                        value: product.id,
                        label: product.label,
                      }))}
                      onChange={(productId) => {
                        const product = productById(productId);
                        if (!product) return;
                        setForm((prev) =>
                          withAutoCohortName(
                            prev,
                            {
                              standardVersion: product.standardVersion,
                              deliverySpine: product.deliverySpine,
                            },
                            nameLocked,
                          ),
                        );
                      }}
                    />
                    {(() => {
                      const product = findProduct(
                        form.standardCode,
                        form.standardVersion,
                        form.deliverySpine,
                      );
                      return product ? (
                        <span className={styles.fieldHint}>{product.summary}</span>
                      ) : null;
                    })()}
                  </label>
                ) : (
                  <>
                    <label className={styles.field}>
                      <span>
                        Standard version{" "}
                        <em className={styles.fieldRequired}>required</em>
                      </span>
                      <input
                        value={form.standardVersion}
                        onChange={(e) =>
                          setForm((prev) =>
                            withAutoCohortName(
                              prev,
                              { standardVersion: e.target.value },
                              nameLocked,
                            ),
                          )
                        }
                        required
                        placeholder="1.3"
                      />
                    </label>
                    <label className={styles.field}>
                      <span>
                        Delivery spine{" "}
                        <em className={styles.fieldRequired}>required</em>
                      </span>
                      <Select
                        value={form.deliverySpine}
                        options={[
                          { value: "groups", label: "Groups (CEA / Temp)" },
                          { value: "blocks", label: "Blocks (programme / Main)" },
                        ]}
                        onChange={(value) =>
                          setForm((prev) =>
                            withAutoCohortName(
                              prev,
                              {
                                deliverySpine: normalizeDeliverySpine(value),
                              },
                              nameLocked,
                            ),
                          )
                        }
                      />
                    </label>
                  </>
                )}
                <label className={styles.field}>
                  <span>Enrolment opens</span>
                  <input
                    type="date"
                    value={form.enrolmentOpensDate}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        enrolmentOpensDate: e.target.value,
                      }))
                    }
                  />
                  <span className={styles.fieldHint}>
                    While planned, new apprentices auto-flow into this cohort from
                    this date until it goes active.
                  </span>
                </label>
                <label className={styles.field}>
                  <span>
                    Intake start{" "}
                    <em className={styles.fieldRequired}>required</em>
                  </span>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => {
                      setForm((prev) =>
                        withAutoCohortFields(
                          prev,
                          { startDate: e.target.value },
                          nameLocked,
                          selectedProgramme?.durationMonths ??
                            programmes.find((p) => p.id === prev.programmeId)
                              ?.durationMonths,
                        ),
                      );
                    }}
                    required
                  />
                </label>
                <label className={styles.field}>
                  <span>Expected end / gateway</span>
                  <input
                    type="date"
                    value={form.expectedEndDate}
                    onChange={(e) =>
                      setForm((prev) =>
                        withAutoCohortName(
                          prev,
                          { expectedEndDate: e.target.value },
                          nameLocked,
                        ),
                      )
                    }
                  />
                  <span className={styles.fieldHint}>
                    {selectedProgramme?.durationMonths
                      ? `Auto-filled as intake start + ${selectedProgramme.durationMonths} months (Skills England typical duration). Edit to override.`
                      : "Auto-fills from Skills England duration once a programme and intake start are set."}
                  </span>
                </label>
                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span>
                    Cohort name{" "}
                    <em className={styles.fieldRequired}>required</em>
                  </span>
                  <input
                    value={form.name}
                    onChange={(e) => {
                      setNameLocked(true);
                      setForm((prev) => ({ ...prev, name: e.target.value }));
                    }}
                    required
                    placeholder="Fills from programme, version, dates…"
                  />
                  <span className={styles.fieldHint}>
                    Auto-filled as programme (code) · version · start–end.
                    Teaching groups and college days are set after create, under
                    each tutor.
                  </span>
                </label>
                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span>Teachers who teach this cohort</span>
                  <CohortTeachersPicker
                    users={store.users}
                    selected={form.teacherNames ?? []}
                    onChange={(teacherNames) =>
                      setForm((prev) => ({
                        ...prev,
                        teacherNames,
                        tutorName: formatCohortTeachers(teacherNames),
                      }))
                    }
                  />
                  <span className={styles.fieldHint}>
                    Add only tutors who will own groups on this intake. Create
                    their day-specific groups after the cohort exists.
                  </span>
                </label>
                <label className={styles.field}>
                  <span>Intake status</span>
                  <Select
                    value={form.status}
                    options={[
                      { value: "planned", label: "Planned" },
                      { value: "active", label: "Active" },
                      { value: "completed", label: "Completed" },
                    ]}
                    onChange={(status) =>
                      setForm((prev) => ({
                        ...prev,
                        status: status as FormState["status"],
                      }))
                    }
                  />
                </label>
                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span>Notes</span>
                  <textarea
                    value={form.notes}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, notes: e.target.value }))
                    }
                    rows={3}
                    placeholder="e.g. Started on v1.2 — finish what they started."
                  />
                </label>
              </div>

              {error ? <p className={styles.error}>{error}</p> : null}

              <div className={styles.formActions}>
                <button type="submit" className={styles.primaryBtn}>
                  {editingId ? "Save cohort" : "Create cohort"}
                </button>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                    setError(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </section>
          </form>
        ) : null}

        <div className={styles.searchBlock}>
          <div className={styles.searchModeRow}>
            <p className={styles.searchModeLabel}>Search by</p>
            <div
              className={styles.searchModeTabs}
              role="group"
              aria-label="Search cohorts by"
            >
              {SEARCH_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  className={
                    searchMode === mode.id
                      ? styles.searchModeActive
                      : styles.searchModeBtn
                  }
                  aria-pressed={searchMode === mode.id}
                  onClick={() => setSearchMode(mode.id)}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            <p className={styles.searchResultCount}>
              {query.trim()
                ? `Showing ${filtered.length} of ${totalCohorts}`
                : `${totalCohorts} cohort${totalCohorts === 1 ? "" : "s"}`}
            </p>
          </div>
          <label className={styles.searchField}>
            <span>Search cohorts</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={activeSearch.placeholder}
            />
          </label>
        </div>

        {filtered.length === 0 ? (
          <p className={styles.empty}>No cohorts match this search.</p>
        ) : (
          <div className={styles.employerList}>
            {filtered.map((row) => {
              const linked = apprenticesForCohort(store.enrolments, row.id);
              const open = expandedId === row.id;
              const isLocked = row.locked !== false;
              const tone =
                row.status === "completed"
                  ? "neutral"
                  : linked.length > 0
                    ? "green"
                    : "amber";
              const candidates = store.enrolments
                .filter(
                  (e) =>
                    e.standardCode.toUpperCase() ===
                      row.standardCode.toUpperCase() ||
                    e.cohortId === row.id,
                )
                .sort((a, b) => a.displayName.localeCompare(b.displayName));

              return (
                <article
                  key={row.id}
                  className={styles.employerCard}
                  data-tone={tone}
                  data-open={open ? "true" : "false"}
                  role="button"
                  tabIndex={0}
                  aria-expanded={open}
                  aria-label={`${open ? "Collapse" : "Expand"} details for ${row.name}`}
                  onClick={() =>
                    void selectExpanded(open ? null : row.id)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      void selectExpanded(open ? null : row.id);
                    }
                  }}
                >
                  <div className={styles.employerCardHeader}>
                    <div className={styles.employerCardMain}>
                      <strong className={styles.employerName}>
                        {cohortDisplayName(row)}
                      </strong>
                      <span>
                        {row.standardCode} ·{" "}
                        {formatCohortProductLabel(
                          row.standardVersion,
                          row.deliverySpine,
                        )}
                      </span>
                      <span>
                        Starts {formatDate(row.startDate)}
                        {row.expectedEndDate
                          ? ` · ends ${formatDate(row.expectedEndDate)}`
                          : ""}
                        {(() => {
                          const teachers = cohortTeacherList(row);
                          const groupCount = (store.teachingGroups ?? []).filter(
                            (g) => g.cohortId === row.id,
                          ).length;
                          const bits: string[] = [];
                          if (teachers.length) {
                            bits.push(
                              `${teachers.length} teacher${teachers.length === 1 ? "" : "s"}`,
                            );
                          }
                          if (groupCount) {
                            bits.push(
                              `${groupCount} group${groupCount === 1 ? "" : "s"}`,
                            );
                          }
                          return bits.length ? ` · ${bits.join(" · ")}` : "";
                        })()}
                      </span>
                    </div>

                    <div
                      className={styles.employerPillColumn}
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <span
                        className={styles.cohortStatusPill}
                        data-status={row.status}
                      >
                        {row.status}
                      </span>
                      <span
                        className={styles.cohortLockPill}
                        data-locked={isLocked ? "true" : "false"}
                      >
                        {isLocked ? "Locked" : "Unlocked"}
                      </span>
                      {linked.length === 0 ? (
                        <span
                          className={styles.employerApprenticePill}
                          data-has="false"
                        >
                          No apprentices
                        </span>
                      ) : (
                        (() => {
                          const menuOpen = apprenticeMenuId === row.id;
                          const useModal =
                            linked.length > APPRENTICE_MODAL_THRESHOLD;
                          const q = apprenticeFilter.trim().toLowerCase();
                          const visible =
                            useModal && q
                              ? linked.filter((l) =>
                                  [l.displayName, l.employerName]
                                    .join(" ")
                                    .toLowerCase()
                                    .includes(q),
                                )
                              : linked;
                          return (
                            <div
                              className={styles.employerApprenticeMenu}
                              ref={
                                menuOpen && !useModal
                                  ? apprenticeMenuRef
                                  : undefined
                              }
                            >
                              <button
                                type="button"
                                className={styles.employerApprenticePill}
                                data-has="true"
                                data-open={menuOpen ? "true" : "false"}
                                aria-haspopup="listbox"
                                aria-expanded={menuOpen}
                                onClick={() =>
                                  setApprenticeMenuId((current) =>
                                    current === row.id ? null : row.id,
                                  )
                                }
                              >
                                <span>
                                  {linked.length === 1
                                    ? "1 apprentice"
                                    : `${linked.length} apprentices`}
                                </span>
                                <span aria-hidden>▾</span>
                              </button>

                              {menuOpen && !useModal ? (
                                <ul
                                  className={styles.employerApprenticeDropdown}
                                  role="listbox"
                                  aria-label={`Apprentices in ${row.name}`}
                                >
                                  {linked.map((apprentice) => (
                                    <li
                                      key={apprentice.id}
                                      role="option"
                                      aria-selected={false}
                                    >
                                      <button
                                        type="button"
                                        className={
                                          styles.employerApprenticeOption
                                        }
                                        onClick={() => {
                                          setExpandedId(row.id);
                                          setApprenticeMenuId(null);
                                        }}
                                      >
                                        <strong>{apprentice.displayName}</strong>
                                        <span>
                                          {enrolmentKindLabel(
                                            apprentice.startDate,
                                            apprentice.kind,
                                          )}
                                          {" · "}
                                          {apprentice.employerName ||
                                            "No employer"}
                                        </span>
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              ) : null}

                              {menuOpen && useModal ? (
                                <div
                                  className={styles.apprenticeModalBackdrop}
                                  role="presentation"
                                  onClick={() => setApprenticeMenuId(null)}
                                >
                                  <div
                                    className={styles.apprenticeModal}
                                    role="dialog"
                                    aria-modal="true"
                                    aria-label={`Apprentices in ${row.name}`}
                                    ref={apprenticeModalRef}
                                    onClick={(event) =>
                                      event.stopPropagation()
                                    }
                                  >
                                    <div className={styles.apprenticeModalHead}>
                                      <div>
                                        <h3
                                          className={styles.apprenticeModalTitle}
                                        >
                                          {row.name}
                                        </h3>
                                        <p className={styles.apprenticeModalMeta}>
                                          {linked.length} apprentices ·{" "}
                                          {formatCohortProductLabel(
                                            row.standardVersion,
                                            row.deliverySpine,
                                          )}
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        className={styles.apprenticeModalClose}
                                        aria-label="Close"
                                        onClick={() =>
                                          setApprenticeMenuId(null)
                                        }
                                      >
                                        ×
                                      </button>
                                    </div>
                                    <input
                                      className={styles.apprenticeModalSearch}
                                      type="search"
                                      autoFocus
                                      value={apprenticeFilter}
                                      onChange={(e) =>
                                        setApprenticeFilter(e.target.value)
                                      }
                                      placeholder="Search apprentices…"
                                    />
                                    {visible.length === 0 ? (
                                      <p className={styles.empty}>
                                        No apprentices match “{apprenticeFilter}”.
                                      </p>
                                    ) : (
                                      <ul
                                        className={styles.apprenticeModalList}
                                        role="listbox"
                                      >
                                        {visible.map((apprentice) => (
                                          <li
                                            key={apprentice.id}
                                            role="option"
                                            aria-selected={false}
                                          >
                                            <button
                                              type="button"
                                              className={
                                                styles.employerApprenticeOption
                                              }
                                              onClick={() => {
                                                setExpandedId(row.id);
                                                setApprenticeMenuId(null);
                                              }}
                                            >
                                              <strong>
                                                {apprentice.displayName}
                                              </strong>
                                              <span>
                                                {enrolmentKindLabel(
                                                  apprentice.startDate,
                                                  apprentice.kind,
                                                )}
                                                {" · "}
                                                {apprentice.employerName ||
                                                  "No employer"}
                                              </span>
                                            </button>
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          );
                        })()
                      )}
                    </div>
                  </div>

                  {open ? (
                    <div
                      className={styles.employerCardBody}
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <div className={styles.employerDetailGrid}>
                        {isLocked ? (
                          <p className={`${styles.fieldHint} ${styles.detailFieldWide}`}>
                            This cohort is locked. Details, teachers, groups, and
                            placements cannot change until you unlock.
                          </p>
                        ) : (
                          <p className={`${styles.fieldHint} ${styles.detailFieldWide}`}>
                            Cohort is unlocked for edits
                            {sessionEdits.length
                              ? ` (${sessionEdits.length} change${sessionEdits.length === 1 ? "" : "s"} this session)`
                              : ""}
                            . Use Save &amp; lock when finished, or leave this
                            cohort to auto-lock.
                          </p>
                        )}
                        <CohortInlineField
                          label="Cohort name"
                          value={row.name}
                          readOnly={isLocked}
                          onCommit={(next) =>
                            void patchCohort(row.id, { name: next })
                          }
                          wide
                        />
                        {isCourseStandard(row.standardCode) ? (
                          <label className={styles.detailField}>
                            <span className={styles.detailFieldLabel}>
                              Cohort product
                            </span>
                            <Select
                              value={resolveProductId(
                                row.standardCode,
                                row.standardVersion,
                                row.deliverySpine,
                              )}
                              disabled={isLocked || isCohortStarted(row)}
                              options={productsForStandard(row.standardCode, {
                                includeFinishers: true,
                              }).map((product) => ({
                                value: product.id,
                                label: product.label,
                              }))}
                              onChange={(productId) => {
                                const product = productById(productId);
                                if (!product) return;
                                void patchCohort(row.id, {
                                  standardVersion: product.standardVersion,
                                  deliverySpine: product.deliverySpine,
                                });
                              }}
                            />
                            {(() => {
                              const product = findProduct(
                                row.standardCode,
                                row.standardVersion,
                                row.deliverySpine,
                              );
                              return product ? (
                                <span className={styles.fieldHint}>
                                  {product.summary}
                                </span>
                              ) : null;
                            })()}
                          </label>
                        ) : (
                          <>
                            <CohortInlineField
                              label="Standard version"
                              value={row.standardVersion}
                              readOnly={isLocked || isCohortStarted(row)}
                              onCommit={(next) =>
                                void patchCohort(row.id, {
                                  standardVersion: next,
                                })
                              }
                              placeholder="1.3"
                            />
                            <label className={styles.detailField}>
                              <span className={styles.detailFieldLabel}>
                                Delivery spine
                              </span>
                              <Select
                                value={normalizeDeliverySpine(row.deliverySpine)}
                                disabled={isLocked || isCohortStarted(row)}
                                options={[
                                  {
                                    value: "groups",
                                    label: "Groups (CEA / Temp)",
                                  },
                                  {
                                    value: "blocks",
                                    label: "Blocks (programme / Main)",
                                  },
                                ]}
                                onChange={(value) =>
                                  void patchCohort(row.id, {
                                    deliverySpine:
                                      normalizeDeliverySpine(value),
                                  })
                                }
                              />
                            </label>
                          </>
                        )}
                        {isCohortStarted(row) ? (
                          <span
                            className={`${styles.fieldHint} ${styles.detailFieldWide}`}
                          >
                            Version and delivery spine are fixed because this
                            cohort has started.
                          </span>
                        ) : null}
                        <label
                          className={`${styles.detailField} ${styles.detailFieldWide}`}
                        >
                          <span className={styles.detailFieldLabel}>
                            Teachers who teach this cohort
                          </span>
                          <CohortTeachersPicker
                            users={store.users}
                            selected={cohortTeacherList(row)}
                            disabled={isLocked}
                            onChange={(teacherNames) =>
                              void patchCohort(row.id, {
                                teacherNames,
                                tutorName: formatCohortTeachers(teacherNames),
                              })
                            }
                          />
                          <span className={styles.fieldHint}>
                            Only selected teachers can own teaching groups below.
                          </span>
                        </label>
                        <CohortInlineField
                          label="Enrolment opens"
                          value={row.enrolmentOpensDate}
                          type="date"
                          readOnly={isLocked}
                          onCommit={(next) =>
                            void patchCohort(row.id, {
                              enrolmentOpensDate: next,
                            })
                          }
                        />
                        <CohortInlineField
                          label="Intake start"
                          value={row.startDate}
                          type="date"
                          readOnly={isLocked}
                          onCommit={(next) =>
                            void patchCohort(row.id, { startDate: next })
                          }
                        />
                        <CohortInlineField
                          label="Expected end"
                          value={row.expectedEndDate}
                          type="date"
                          readOnly={isLocked}
                          onCommit={(next) =>
                            void patchCohort(row.id, { expectedEndDate: next })
                          }
                        />
                        <label className={styles.detailField}>
                          <span className={styles.detailFieldLabel}>
                            Intake status
                          </span>
                          <Select
                            value={row.status}
                            disabled={isLocked}
                            options={[
                              { value: "planned", label: "Planned" },
                              { value: "active", label: "Active" },
                              { value: "completed", label: "Completed" },
                            ]}
                            onChange={(status) =>
                              void patchCohort(row.id, {
                                status: status as AdminCohortRecord["status"],
                              })
                            }
                          />
                        </label>
                        <CohortInlineField
                          label="Notes"
                          value={row.notes}
                          readOnly={isLocked}
                          onCommit={(next) =>
                            void patchCohort(row.id, { notes: next })
                          }
                          wide
                          multiline
                        />
                      </div>

                      <CohortTeachingGroupsPanel
                        cohort={row}
                        groups={store.teachingGroups ?? []}
                        enrolments={store.enrolments}
                        candidates={candidates}
                        locked={isLocked}
                        onSessionEdit={recordSessionEdit}
                        onError={setError}
                        onSuccess={setSuccess}
                      />

                      <div className={styles.formGroupHead}>
                        <h3 className={styles.formGroupTitle}>Change history</h3>
                        <span className={styles.formGroupBadge}>
                          {
                            (store.cohortChangeLogs ?? []).filter(
                              (entry) => entry.cohortId === row.id,
                            ).length
                          }
                        </span>
                      </div>
                      {(store.cohortChangeLogs ?? []).filter(
                        (entry) => entry.cohortId === row.id,
                      ).length === 0 ? (
                        <p className={styles.empty}>
                          No lock sessions recorded yet.
                        </p>
                      ) : (
                        <ul className={styles.linkedApprenticeList}>
                          {(store.cohortChangeLogs ?? [])
                            .filter((entry) => entry.cohortId === row.id)
                            .map((entry) => (
                              <li key={entry.id}>
                                <div className={styles.linkedApprenticeRow}>
                                  <div className={styles.linkedApprenticeMain}>
                                    <strong>
                                      {entry.actorName
                                        ? `${entry.actorName}`
                                        : "Unknown user"}
                                    </strong>
                                    <span>
                                      {new Date(entry.createdAt).toLocaleString(
                                        "en-GB",
                                      )}
                                      {entry.details.length
                                        ? ` · ${entry.details.length} change${entry.details.length === 1 ? "" : "s"}`
                                        : " · no structural changes"}
                                    </span>
                                    {entry.details.length > 0 ? (
                                      <span
                                        className={styles.fieldHint}
                                        style={{
                                          display: "flex",
                                          flexDirection: "column",
                                          gap: "0.2rem",
                                        }}
                                      >
                                        {entry.details.map((line, index) => (
                                          <span key={`${entry.id}-${index}`}>
                                            · {line}
                                          </span>
                                        ))}
                                      </span>
                                    ) : (
                                      <span className={styles.fieldHint}>
                                        Locked the cohort without editing
                                        details, groups, or placements.
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </li>
                            ))}
                        </ul>
                      )}

                      <div className={styles.formActions}>
                        <Link
                          href="/administration/programmes"
                          className={styles.secondaryBtn}
                        >
                          Programme records
                        </Link>
                        {isLocked ? (
                          <button
                            type="button"
                            className={styles.secondaryBtn}
                            disabled={lockBusy}
                            onClick={() =>
                              void (async () => {
                                const clean = cohortDisplayName(row);
                                await patchCohort(row.id, { locked: false });
                                if (clean && clean !== row.name) {
                                  await patchCohort(row.id, { name: clean });
                                }
                              })()
                            }
                          >
                            Unlock for corrections
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              className={styles.secondaryBtn}
                              disabled={lockBusy}
                              onClick={() => openEdit(row)}
                            >
                              Open full edit form
                            </button>
                            <button
                              type="button"
                              className={styles.primaryBtn}
                              disabled={lockBusy}
                              onClick={() => void flushLockSession(row.id)}
                            >
                              {lockBusy ? "Saving…" : "Save & lock"}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </ApprenticePageShell>
  );
}
