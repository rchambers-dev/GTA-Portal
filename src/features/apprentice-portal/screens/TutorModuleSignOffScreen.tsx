"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  formatModuleDate,
  getTutorSignOffQueue,
  type TutorSignOffItem,
  type TutorSignOffQueueStatus,
} from "../domain/apprentice-profile";
import {
  ApprenticeStatusChip,
} from "../components/ApprenticePageShell";
import styles from "./TutorModuleSignOffScreen.module.css";

type LocalStatus = TutorSignOffQueueStatus | "redo_requested";

function toneFor(status: LocalStatus) {
  switch (status) {
    case "signed_off":
      return "green" as const;
    case "awaiting_sign_off":
      return "amber" as const;
    case "redo_requested":
      return "red" as const;
    default:
      return "neutral" as const;
  }
}

function labelFor(status: LocalStatus) {
  switch (status) {
    case "signed_off":
      return "Completed";
    case "awaiting_sign_off":
      return "Needs sign-off";
    case "redo_requested":
      return "Do again";
    default:
      return "Still to do";
  }
}

function SignOffCard({
  item,
  status,
  onRequestRedo,
}: {
  item: TutorSignOffItem;
  status: LocalStatus;
  onRequestRedo?: () => void;
}) {
  return (
    <article className={styles.card}>
      <div className={styles.cardMain}>
        <p className={styles.apprentice}>{item.apprenticeName}</p>
        <h3 className={styles.topic}>{item.topicTitle}</h3>
        <p className={styles.meta}>
          {item.moduleCode} · {item.moduleTitle}
        </p>
        <p className={styles.meta}>{item.programmeName}</p>
        {status === "signed_off" ? (
          <p className={styles.meta}>
            Signed off by {item.signedOffBy}
            {item.signedOffRole ? ` (${item.signedOffRole})` : ""} ·{" "}
            {formatModuleDate(item.coveredAt)}
          </p>
        ) : null}
        {item.note ? <p className={styles.meta}>{item.note}</p> : null}
        {item.evidenceSummary ? (
          <p className={styles.evidence}>{item.evidenceSummary}</p>
        ) : null}
      </div>
      <div className={styles.cardSide}>
        <ApprenticeStatusChip tone={toneFor(status)}>
          {labelFor(status)}
        </ApprenticeStatusChip>
        {status === "signed_off" && onRequestRedo ? (
          <button type="button" className={styles.redoBtn} onClick={onRequestRedo}>
            Ask to do again
          </button>
        ) : null}
        {status === "redo_requested" ? (
          <p className={styles.stubNote}>Stub: apprentice notified to resubmit</p>
        ) : null}
        {status === "awaiting_sign_off" ? (
          <p className={styles.stubNote}>Stub: sign-off action coming later</p>
        ) : null}
      </div>
    </article>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>
        {title}
        <span className={styles.count}> · {count}</span>
      </h2>
      {count === 0 ? (
        <p className={styles.empty}>Nothing in this list.</p>
      ) : (
        <div className={styles.cards}>{children}</div>
      )}
    </section>
  );
}

export function TutorModuleSignOffScreen() {
  const base = useMemo(() => getTutorSignOffQueue(), []);
  const [overrides, setOverrides] = useState<Record<string, LocalStatus>>({});

  const withStatus = base.map((item) => ({
    item,
    status: overrides[item.id] ?? item.queueStatus,
  }));

  const awaiting = withStatus.filter((x) => x.status === "awaiting_sign_off");
  const needsDoing = withStatus.filter((x) => x.status === "needs_doing");
  const completed = withStatus.filter((x) => x.status === "signed_off");
  const redo = withStatus.filter((x) => x.status === "redo_requested");

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Tutor workspace</p>
        <h1 className={styles.title}>Module sign-offs</h1>
        <p className={styles.lead}>
          Everything that needs covering or signing off for your apprentices —
          completed outcomes, outstanding work, and ask-to-do-again (stubbed).
        </p>
      </header>

      <div className={styles.summary}>
        <div className={styles.glance}>
          <span className={styles.glanceLabel}>Needs sign-off</span>
          <strong>{awaiting.length}</strong>
        </div>
        <div className={styles.glance}>
          <span className={styles.glanceLabel}>Still to do</span>
          <strong>{needsDoing.length}</strong>
        </div>
        <div className={styles.glance}>
          <span className={styles.glanceLabel}>Completed</span>
          <strong>{completed.length}</strong>
        </div>
        <div className={styles.glance}>
          <span className={styles.glanceLabel}>Do again</span>
          <strong>{redo.length}</strong>
        </div>
      </div>

      <Section title="Needs sign-off" count={awaiting.length}>
        {awaiting.map(({ item, status }) => (
          <SignOffCard key={item.id} item={item} status={status} />
        ))}
      </Section>

      <Section title="Still to do" count={needsDoing.length}>
        {needsDoing.map(({ item, status }) => (
          <SignOffCard key={item.id} item={item} status={status} />
        ))}
      </Section>

      <Section title="Completed" count={completed.length}>
        {completed.map(({ item, status }) => (
          <SignOffCard
            key={item.id}
            item={item}
            status={status}
            onRequestRedo={() =>
              setOverrides((prev) => ({ ...prev, [item.id]: "redo_requested" }))
            }
          />
        ))}
      </Section>

      <Section title="Asked to do again" count={redo.length}>
        {redo.map(({ item, status }) => (
          <SignOffCard key={item.id} item={item} status={status} />
        ))}
      </Section>
    </div>
  );
}
