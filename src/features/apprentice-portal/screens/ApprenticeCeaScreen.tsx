"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "../components/ApprenticePageShell";
import {
  ALEX_CEA_STATE,
  expectedSignOffRole,
  groupAdditionalSignedOffCount,
  groupMandatoryComplete,
  packOverview,
  ceaStatusLabel,
  ceaStatusTone,
  resolveGroupsPack,
  type CeaGroupDef,
  type CeaApprenticeState,
  type CeaTaskDef,
  type CeaTaskProgress,
} from "../domain/cea";
import { ALEX_PROFILE } from "../domain/mock-apprentice";
import styles from "./apprentice-pages.module.css";

function emptyProgress(taskId: string, kind: "mandatory" | "additional"): CeaTaskProgress {
  return {
    taskId,
    kind,
    additionalEnabled: kind === "additional",
    status: "not_started",
    apprenticeNotes: "",
    readyAt: null,
    signedOffByRole: null,
    signedOffByName: null,
    signedOffAt: null,
    returnNote: null,
  };
}

function TaskRow({
  task,
  progress,
  onSaveNotes,
  onMarkReady,
}: {
  task: CeaTaskDef;
  progress: CeaTaskProgress;
  onSaveNotes: (taskId: string, notes: string) => void;
  onMarkReady: (taskId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(progress.apprenticeNotes);
  const signer = expectedSignOffRole(progress.kind);

  return (
    <li className={styles.ceaTask}>
      <button
        type="button"
        className={styles.ceaTaskToggle}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.ceaTaskMain}>
          <strong>
            CEA task {task.number}: {task.title}
          </strong>
          <span>
            {progress.kind === "mandatory" ? "Mandatory" : "Additional @ work"} · Sign-off:{" "}
            {signer === "teacher" ? "Teacher" : "Employer"}
            {task.alwaysMandatory ? " · Always required" : ""}
          </span>
        </span>
        <span className={styles.ceaTaskMeta}>
          <ApprenticeStatusChip tone={ceaStatusTone(progress.status)}>
            {ceaStatusLabel(progress.status)}
          </ApprenticeStatusChip>
          <span className={styles.otjChevron} aria-hidden>
            {open ? "▾" : "▸"}
          </span>
        </span>
      </button>

      {open ? (
        <div className={styles.ceaTaskPanel}>
          {task.relatedTeaching ? (
            <p className={styles.meta}>
              Related teaching: {task.relatedTeaching.label}
              {task.relatedTeaching.moduleId ? (
                <>
                  {" · "}
                  <Link
                    className={styles.linkish}
                    href={`/apprentice/modules/${task.relatedTeaching.moduleId}`}
                  >
                    View coverage
                  </Link>
                </>
              ) : null}
              {task.relatedTeaching.imiRefs.length > 0 ? (
                <> · {task.relatedTeaching.imiRefs.join(", ")}</>
              ) : null}
              {task.relatedTeaching.needsStaffConfirm ? " · Staff can confirm mapping" : null}
            </p>
          ) : null}

          {progress.signedOffByName ? (
            <p className={styles.meta}>
              Signed off by {progress.signedOffByName} ({progress.signedOffByRole})
              {progress.signedOffAt
                ? ` · ${new Date(progress.signedOffAt).toLocaleDateString("en-GB")}`
                : ""}
            </p>
          ) : null}

          {progress.returnNote ? (
            <p className={styles.note}>{progress.returnNote}</p>
          ) : null}

          {progress.status === "signed_off" ? (
            <p className={styles.meta}>
              {progress.apprenticeNotes || "No apprentice notes recorded."}
            </p>
          ) : (
            <>
              <label className={styles.field}>
                <span>Your notes (ready for assess)</span>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What you did, where, and any evidence reference…"
                />
              </label>
              <div className={styles.formActions}>
                <button
                  type="button"
                  className={styles.ghostBtn}
                  onClick={() => onSaveNotes(task.id, notes)}
                >
                  Save notes
                </button>
                {progress.status !== "ready_to_assess" ? (
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={() => {
                      onSaveNotes(task.id, notes);
                      onMarkReady(task.id);
                    }}
                  >
                    Mark ready for {signer === "teacher" ? "teacher" : "employer"}
                  </button>
                ) : (
                  <span className={styles.meta}>
                    Waiting for {signer === "teacher" ? ALEX_PROFILE.tutorName : ALEX_PROFILE.employerContact}{" "}
                    to sign off
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      ) : null}
    </li>
  );
}

function GroupBlock({
  group,
  state,
  onSaveNotes,
  onMarkReady,
}: {
  group: CeaGroupDef;
  state: CeaApprenticeState;
  onSaveNotes: (taskId: string, notes: string) => void;
  onMarkReady: (taskId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const allocated = state.mandatoryByGroup[group.id] ?? [];
  const mandatoryDone = allocated.filter(
    (id) => state.progress[id]?.status === "signed_off",
  ).length;
  const complete = groupMandatoryComplete(group, state);
  const extraCount = groupAdditionalSignedOffCount(group, state);

  const mandatoryTasks = group.tasks.filter((t) => allocated.includes(t.id));
  const additionalTasks = group.tasks.filter((t) => {
    const p = state.progress[t.id];
    return p?.kind === "additional" && p.additionalEnabled;
  });
  const otherPool = group.tasks.filter(
    (t) => !allocated.includes(t.id) && !additionalTasks.some((a) => a.id === t.id),
  );

  return (
    <section className={styles.ceaGroup}>
      <button
        type="button"
        className={styles.ceaGroupToggle}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>
          <strong>
            Group {group.number}: {group.title}
          </strong>
          <span className={styles.meta}>
            {group.phaseLabel} · Mandatory {mandatoryDone}/{group.mandatoryRequired}
            {extraCount > 0 ? ` · +${extraCount} additional` : ""}
            {complete ? " · Group complete" : ""}
          </span>
        </span>
        <span className={styles.ceaTaskMeta}>
          <ApprenticeStatusChip tone={complete ? "green" : "amber"}>
            {complete ? "Mandatory met" : "In progress"}
          </ApprenticeStatusChip>
          <span className={styles.otjChevron} aria-hidden>
            {open ? "▾" : "▸"}
          </span>
        </span>
      </button>

      {open ? (
        <div className={styles.ceaGroupBody}>
          <p className={styles.meta}>
            Teacher allocates {group.mandatoryRequired} mandatory task
            {group.mandatoryRequired === 1 ? "" : "s"} (teacher sign-off). Extra
            tasks can be enabled for workplace completion (employer sign-off).
            {group.knowledgeTestNote ? ` · ${group.knowledgeTestNote}` : ""}
          </p>

          <h3 className={styles.ceaSubhead}>Mandatory tasks</h3>
          {mandatoryTasks.length === 0 ? (
            <p className={styles.empty}>Teacher has not allocated mandatory tasks yet.</p>
          ) : (
            <ul className={styles.ceaTaskList}>
              {mandatoryTasks.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  progress={state.progress[t.id] ?? emptyProgress(t.id, "mandatory")}
                  onSaveNotes={onSaveNotes}
                  onMarkReady={onMarkReady}
                />
              ))}
            </ul>
          )}

          <h3 className={styles.ceaSubhead}>Additional activities</h3>
          {additionalTasks.length === 0 ? (
            <p className={styles.meta}>
              No additional workplace tasks enabled yet.
              {otherPool.length > 0
                ? ` ${otherPool.length} other task(s) in this group can be enabled by your teacher.`
                : ""}
            </p>
          ) : (
            <ul className={styles.ceaTaskList}>
              {additionalTasks.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  progress={state.progress[t.id] ?? emptyProgress(t.id, "additional")}
                  onSaveNotes={onSaveNotes}
                  onMarkReady={onMarkReady}
                />
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}

function SupportBlock({
  title,
  hint,
  items,
  defaultOpen = false,
}: {
  title: string;
  hint?: string;
  items: Array<{ id: string; title: string; status: "not_started" | "complete" }>;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const done = items.filter((i) => i.status === "complete").length;

  return (
    <section className={styles.ceaGroup}>
      <button
        type="button"
        className={styles.ceaGroupToggle}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>
          <strong>{title}</strong>
          <span className={styles.meta}>
            {hint ? `${hint} · ` : ""}
            {done}/{items.length} complete
          </span>
        </span>
        <span className={styles.ceaTaskMeta}>
          <ApprenticeStatusChip tone={done === items.length ? "green" : "neutral"}>
            {done === items.length ? "Complete" : "Before course groups"}
          </ApprenticeStatusChip>
          <span className={styles.otjChevron} aria-hidden>
            {open ? "▾" : "▸"}
          </span>
        </span>
      </button>
      {open ? (
        <div className={styles.ceaGroupBody}>
          <ul className={styles.list}>
            {items.map((item) => (
              <li key={item.id} className={styles.row}>
                <div className={styles.rowMain}>
                  <strong>{item.title}</strong>
                </div>
                <ApprenticeStatusChip
                  tone={item.status === "complete" ? "green" : "neutral"}
                >
                  {item.status === "complete" ? "Complete" : "Not started"}
                </ApprenticeStatusChip>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function GatewayBlock({
  title,
  phaseLabel,
  items,
  reflection,
  onReflectionChange,
}: {
  title: string;
  phaseLabel: string;
  items: Array<{ id: string; code: string; title: string; status: import("../domain/cea").CeaTaskStatus }>;
  reflection?: { text: string; status: string };
  onReflectionChange?: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className={`${styles.ceaGroup} ${styles.ceaGatewayBlock}`}>
      <button
        type="button"
        className={styles.ceaGroupToggle}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>
          <strong>{title}</strong>
          <span className={styles.meta}>{phaseLabel}</span>
        </span>
        <span className={styles.ceaTaskMeta}>
          <ApprenticeStatusChip tone="blue">Gateway</ApprenticeStatusChip>
          <span className={styles.otjChevron} aria-hidden>
            {open ? "▾" : "▸"}
          </span>
        </span>
      </button>
      {open ? (
        <div className={styles.ceaGroupBody}>
          <ul className={styles.ceaGatewayList}>
            {items.map((item) => (
              <li key={item.id}>
                <span>
                  {item.code} · {item.title}
                </span>
                <ApprenticeStatusChip tone={ceaStatusTone(item.status)}>
                  {ceaStatusLabel(item.status)}
                </ApprenticeStatusChip>
              </li>
            ))}
          </ul>
          {onReflectionChange ? (
            <label className={styles.field}>
              <span>Reflection for this stage</span>
              <textarea
                rows={3}
                value={reflection?.text ?? ""}
                onChange={(e) => onReflectionChange(e.target.value)}
                placeholder="Reflect on what you completed leading into this gateway…"
              />
              <span className={styles.meta}>
                Status: {reflection?.status ?? "draft"}
              </span>
            </label>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function FlowHeading({ children }: { children: string }) {
  return <h2 className={styles.ceaFlowHeading}>{children}</h2>;
}

export function ApprenticeCeaScreen() {
  const pack = resolveGroupsPack("ST0499", "1.3");
  const [state, setState] = useState<CeaApprenticeState>(() => ({
    ...ALEX_CEA_STATE,
    packId: pack?.id ?? ALEX_CEA_STATE.packId,
  }));
  const overview = useMemo(
    () => (pack ? packOverview(pack, state) : null),
    [pack, state],
  );

  if (!pack || !overview) {
    return (
      <ApprenticePageShell
        eyebrow="My learning"
        title="CEA tasks"
        description="No groups pack is available for this programme version."
      >
        <p>Contact your tutor if this looks wrong.</p>
      </ApprenticePageShell>
    );
  }

  const activePack = pack;

  const preCourseEquality = activePack.supportItems.filter(
    (i) => i.section === "Equality and Diversity",
  );
  const preCourseFunctional = activePack.supportItems.filter(
    (i) => i.section === "Functional Skills",
  );
  const preCourseBoltOns = activePack.supportItems.filter(
    (i) => i.section === "Bolt-on Courses",
  );
  const evidenceYear1 = activePack.supportItems.filter(
    (i) =>
      i.section === "Evidence Collection" &&
      (i.title.includes("Tyres") ||
        i.title.includes("Brakes") ||
        i.title.includes("Steering")),
  );

  const groupsBeforeGateway1 = activePack.groups
    .filter((g) => g.number <= 7)
    .sort((a, b) => a.number - b.number);
  const groupsAfterGateway1 = activePack.groups
    .filter((g) => g.number >= 8)
    .sort((a, b) => a.number - b.number);
  const gateway1 = activePack.gatewayItems.filter(
    (g) => g.milestoneId === "ms-gateway1",
  );
  const gateway2 = activePack.gatewayItems.filter(
    (g) => g.milestoneId === "ms-gateway2",
  );

  function saveNotes(taskId: string, notes: string) {
    setState((prev) => {
      const existing =
        prev.progress[taskId] ??
        emptyProgress(
          taskId,
          (prev.mandatoryByGroup[
            activePack.groups.find((g) =>
              g.tasks.some((t) => t.id === taskId),
            )?.id ?? ""
          ] ?? []
          ).includes(taskId)
            ? "mandatory"
            : "additional",
        );
      return {
        ...prev,
        progress: {
          ...prev.progress,
          [taskId]: {
            ...existing,
            apprenticeNotes: notes,
            status:
              existing.status === "not_started" ? "in_progress" : existing.status,
          },
        },
      };
    });
  }

  function markReady(taskId: string) {
    setState((prev) => {
      const existing = prev.progress[taskId];
      if (!existing) return prev;
      return {
        ...prev,
        progress: {
          ...prev.progress,
          [taskId]: {
            ...existing,
            status: "ready_to_assess",
            readyAt: new Date().toISOString(),
          },
        },
      };
    });
  }

  function updateReflection(milestoneId: string, text: string) {
    setState((prev) => ({
      ...prev,
      milestoneReflections: {
        ...prev.milestoneReflections,
        [milestoneId]: {
          text,
          status: prev.milestoneReflections[milestoneId]?.status ?? "draft",
        },
      },
    }));
  }

  return (
    <ApprenticePageShell
      title="CEA tasks"
      description={`${pack.standardLabel} · ${pack.title} ${pack.version}. Read top to bottom — induction items first, then groups in order, with gateways where they sit on the tracking sheet.`}
    >
      <div className={styles.stack}>
        <div className={styles.ceaOverview}>
          <div>
            <p className={styles.otjKicker}>{pack.standardCode}</p>
            <h2 className={styles.otjHeroTitle}>{pack.title}</h2>
            <p className={styles.meta}>
              Apprentice: {ALEX_PROFILE.displayName} · Tutor: {ALEX_PROFILE.tutorName}
            </p>
          </div>
          <div className={styles.ceaOverviewStats}>
            <div className={styles.otjSummaryCard} data-tone="green">
              <p className={styles.glanceLabel}>Groups complete</p>
              <p className={styles.glanceValue}>
                {overview.groupsComplete}/{overview.groupsTotal}
              </p>
            </div>
            <div className={styles.otjSummaryCard} data-tone="blue">
              <p className={styles.glanceLabel}>Mandatory signed</p>
              <p className={styles.glanceValue}>
                {overview.mandatorySigned}/{overview.mandatoryTotal}
              </p>
            </div>
            <div className={styles.otjSummaryCard} data-tone="amber">
              <p className={styles.glanceLabel}>Awaiting teacher</p>
              <p className={styles.glanceValue}>{overview.awaitingTeacher}</p>
            </div>
            <div className={styles.otjSummaryCard} data-tone="amber">
              <p className={styles.glanceLabel}>Awaiting employer</p>
              <p className={styles.glanceValue}>{overview.awaitingEmployer}</p>
            </div>
          </div>
        </div>

        <FlowHeading>Before you start the course groups</FlowHeading>
        <p className={styles.meta}>
          Non-course induction items first — then Group 1 onwards in sheet order.
          Each block is minimised; open one to work on it.
        </p>
        <div className={styles.ceaGroupStack}>
          <SupportBlock
            title="Equality and Diversity"
            hint="Induction"
            items={preCourseEquality}
          />
          <SupportBlock
            title="Functional Skills"
            hint="English & maths"
            items={preCourseFunctional}
          />
          <SupportBlock
            title="Bolt-on courses"
            hint="First aid, H&S, manual handling, fire"
            items={preCourseBoltOns}
          />
        </div>

        <FlowHeading>Year 1 · Groups 1–7</FlowHeading>
        <div className={styles.ceaGroupStack}>
          {groupsBeforeGateway1.map((group) => (
            <GroupBlock
              key={group.id}
              group={group}
              state={state}
              onSaveNotes={saveNotes}
              onMarkReady={markReady}
            />
          ))}
        </div>

        <FlowHeading>Before Gateway 1</FlowHeading>
        <div className={styles.ceaGroupStack}>
          <SupportBlock
            title="Evidence collection"
            hint="Professional quality job cards"
            items={evidenceYear1}
          />
          <GatewayBlock
            title="Gateway 1"
            phaseLabel="After Group 7 · gateway assessments & e-logbook review"
            items={gateway1}
            reflection={state.milestoneReflections["ms-year1-systems"]}
            onReflectionChange={(text) => updateReflection("ms-year1-systems", text)}
          />
        </div>

        <FlowHeading>Year 2 · Groups 8–14</FlowHeading>
        <div className={styles.ceaGroupStack}>
          {groupsAfterGateway1.map((group) => (
            <GroupBlock
              key={group.id}
              group={group}
              state={state}
              onSaveNotes={saveNotes}
              onMarkReady={markReady}
            />
          ))}
        </div>

        <FlowHeading>Gateway 2 & EPA</FlowHeading>
        <div className={styles.ceaGroupStack}>
          <GatewayBlock
            title="Gateway 2"
            phaseLabel="After Group 14 · final gateway & e-logbook review"
            items={gateway2}
            reflection={state.milestoneReflections["ms-year2-systems"]}
            onReflectionChange={(text) => updateReflection("ms-year2-systems", text)}
          />
          <GatewayBlock
            title="EPA"
            phaseLabel="21–24 months · End-point assessment (IMI AS-AC-EPA)"
            items={[
              {
                id: "epa-result",
                code: "EPA/O",
                title: "End-point assessment outcome",
                status: "not_started",
              },
            ]}
          />
        </div>
      </div>
    </ApprenticePageShell>
  );
}
