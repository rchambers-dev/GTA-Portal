"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CYCLE_STEPS } from "../domain/cycle";
import { peersFor, type CycleLearner, type CyclePage } from "../domain/cycle-view";
import { signSafeguardingAction } from "./cycle-actions";
import styles from "./cycle.module.css";

function signCountLabel(count: number) {
  return `Sign ${count} ${count === 1 ? "apprentice" : "apprentices"}`;
}

export function CycleView({
  workspace,
  page,
}: {
  workspace: "administration" | "management";
  page: CyclePage;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [tutor, setTutor] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [signing, setSigning] = useState<CycleLearner | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return page.learners.filter((learner) => {
      if (tutor !== "all" && learner.tutor !== tutor) return false;
      if (!needle) return true;
      return [learner.name, learner.tutor, learner.company, learner.postcode].join(" ").toLowerCase().includes(needle);
    });
  }, [page.learners, query, tutor]);

  const groups = CYCLE_STEPS.map((step) => ({
    ...step,
    rows: filtered.filter((learner) => learner.stepId === step.id),
  })).filter((group) => group.rows.length > 0);

  function openSign(learner: CycleLearner) {
    setError("");
    setSigning(learner);
    setPicked([learner.gtaId]);
  }

  async function confirmSign() {
    if (!signing) return;
    setBusy(true);
    setError("");
    const result = await signSafeguardingAction({ gtaIds: picked });
    setBusy(false);
    if (!result.ok) {
      setError(result.formError);
      return;
    }
    setSigning(null);
    router.refresh();
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1>Review cycle</h1>
        <p>Search a name, tutor, company or postcode. Empty steps stay hidden.</p>
      </header>
      {page.loadError ? <p className={styles.error} role="alert">{page.loadError}</p> : null}
      <div className={styles.tools}>
        <input
          className={styles.search}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search a name, tutor, company or postcode"
          aria-label="Search learners"
        />
        <select className={styles.select} value={tutor} onChange={(event) => setTutor(event.target.value)} aria-label="All tutors">
          <option value="all">All tutors</option>
          {page.tutors.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <span className={styles.count}>{filtered.length} learners</span>
      </div>
      {groups.map((group) => {
        const sectionOpen = !collapsed[group.id];
        return (
        <section key={group.id} className={sectionOpen ? styles.group : `${styles.group} ${styles.groupClosed}`}>
          <h2 className={styles.groupHead}>
            <button
              type="button"
              className={styles.groupToggle}
              aria-expanded={sectionOpen}
              onClick={() => setCollapsed((current) => ({ ...current, [group.id]: sectionOpen }))}
            >
              <span className={sectionOpen ? styles.groupChevronOpen : styles.groupChevron} aria-hidden="true">▸</span>
              {group.label}
              <span className={styles.badge}>{group.rows.length}</span>
            </button>
          </h2>
          {sectionOpen ? group.rows.map((learner) => {
            const expanded = openId === learner.gtaId;
            return (
              <article key={learner.gtaId} className={styles.row}>
                <div className={styles.line}>
                  <button
                    type="button"
                    className={styles.expand}
                    aria-expanded={expanded}
                    aria-label={expanded ? `Hide ${learner.name}` : `Show ${learner.name}`}
                    onClick={() => setOpenId(expanded ? null : learner.gtaId)}
                  >
                    {expanded ? "▾" : "▸"}
                  </button>
                  <span className={styles.name}>{learner.name}</span>
                  <button
                    type="button"
                    className={styles.reviewBtn}
                    onClick={() => router.push(`/${workspace}/onboarding/apprentice/${learner.gtaId}?tab=reviews`)}
                  >
                    {learner.reviewCountLabel}
                  </button>
                  <span className={learner.late ? `${styles.chip} ${styles.late}` : styles.chip}>{learner.timing}</span>
                  <span className={styles.chip}>{learner.stepLabel}</span>
                  <span className={styles.grow} />
                  {learner.signedLabel ? (
                    <span className={styles.signed}>{learner.signedLabel}</span>
                  ) : (
                    <button type="button" className={styles.signBtn} onClick={() => openSign(learner)}>
                      Sign safeguarding
                    </button>
                  )}
                </div>
                {expanded ? (
                  <div className={styles.steps}>
                    {learner.steps.map((step) => (
                      <div
                        key={step.id}
                        className={`${styles.step} ${
                          step.tone === "done"
                            ? styles.toneDone
                            : step.tone === "current"
                              ? styles.toneCurrent
                              : step.tone === "late"
                                ? styles.toneLate
                                : ""
                        }`}
                      >
                        <strong>{step.label}</strong>
                        <span>{step.detail}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          }) : null}
        </section>
        );
      })}
      {signing ? (
        <div className={styles.popup} role="presentation">
          <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="sign-title">
            <h2 id="sign-title">Sign safeguarding</h2>
            <p>
              Today is recorded against each ticked apprentice. Only learners with the same manager and the same programme are listed. This cannot be undone.
            </p>
            <div className={styles.checks}>
              <label>
                <input type="checkbox" checked disabled={signing.signedOn != null} readOnly />
                <span>{signing.name}</span>
              </label>
              {peersFor(signing, page.learners).map((peer) => (
                <label key={peer.gtaId} className={peer.signedOn ? styles.locked : undefined}>
                  <input
                    type="checkbox"
                    disabled={Boolean(peer.signedOn)}
                    checked={Boolean(peer.signedOn) || picked.includes(peer.gtaId)}
                    onChange={(event) => {
                      setPicked((current) =>
                        event.target.checked ? [...current, peer.gtaId] : current.filter((id) => id !== peer.gtaId),
                      );
                    }}
                  />
                  <span>
                    {peer.name}
                    {peer.signedOn ? ` · ${peer.signedLabel}` : ""}
                  </span>
                </label>
              ))}
            </div>
            {error ? <p className={styles.error} role="alert">{error}</p> : null}
            <div className={styles.actions}>
              <button type="button" className={styles.cancel} onClick={() => setSigning(null)}>Cancel</button>
              <button type="button" className={styles.confirm} disabled={busy} onClick={confirmSign}>
                {signCountLabel(picked.filter((id) => {
                  const person = id === signing.gtaId ? signing : page.learners.find((learner) => learner.gtaId === id);
                  return person && !person.signedOn;
                }).length)}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
