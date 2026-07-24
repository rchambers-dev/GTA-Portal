"use client";

import Link from "next/link";
import {
  LearnerPageShell,
  LearnerStatusChip,
} from "../components/LearnerPageShell";
import { useLearnerChat } from "../components/LearnerChatProvider";
import { ALEX_PROFILE } from "../domain/mock-learner";
import styles from "./learner-pages.module.css";

export function LearnerSupportScreen() {
  const { ensureThreadWithContact } = useLearnerChat();

  function openSupportChat() {
    ensureThreadWithContact("contact-support-gta");
  }

  function openMentorChat() {
    ensureThreadWithContact(ALEX_PROFILE.mentorId);
  }

  function openTutorChat() {
    ensureThreadWithContact(ALEX_PROFILE.tutorId);
  }

  return (
    <LearnerPageShell
      title="Support"
      description="How to get help. Support chat is private from your mentor unless you choose to involve them."
    >
      <div className={styles.stack}>
        <p className={styles.note}>
          If you are in immediate danger or need urgent help outside GTA hours, contact emergency
          services or a trusted adult. GTA Support can help with welfare, Ask GTA questions, and
          navigating your apprenticeship.
        </p>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Ways to get help</h2>
          <ul className={styles.list}>
            <li>
              <Link
                className={styles.rowLink}
                href="/learner/messages"
                onClick={openSupportChat}
              >
                <div className={styles.rowMain}>
                  <strong>GTA Support chat</strong>
                  <span>
                    Private channel — only you and Support can read it. Your mentor does not see
                    the contents by default.
                  </span>
                </div>
                <span className={styles.linkish}>Open Support chat →</span>
              </Link>
            </li>
            <li>
              <Link
                className={styles.rowLink}
                href="/learner/messages"
                onClick={openMentorChat}
              >
                <div className={styles.rowMain}>
                  <strong>Progress mentor</strong>
                  <span>
                    {ALEX_PROFILE.mentorName} — day-to-day pastoral and progress questions via
                    direct messages.
                  </span>
                </div>
                <span className={styles.linkish}>Message mentor →</span>
              </Link>
            </li>
            <li>
              <Link
                className={styles.rowLink}
                href="/learner/messages"
                onClick={openTutorChat}
              >
                <div className={styles.rowMain}>
                  <strong>Tutor</strong>
                  <span>
                    {ALEX_PROFILE.tutorName} — academic and workshop questions via direct
                    messages.
                  </span>
                </div>
                <span className={styles.linkish}>Message tutor →</span>
              </Link>
            </li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>What you won&apos;t see here</h2>
          <p className={styles.meta}>
            Confidential staff case notes and internal welfare assessments stay with Support and
            authorised handlers. This page never shows those records.
          </p>
        </section>
      </div>
    </LearnerPageShell>
  );
}
