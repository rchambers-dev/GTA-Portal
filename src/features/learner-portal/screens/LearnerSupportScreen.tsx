"use client";

import Link from "next/link";
import { LearnerPageShell } from "../components/LearnerPageShell";
import { useLearnerChat } from "../components/LearnerChatProvider";
import { ALEX_PROFILE } from "../domain/mock-learner";
import styles from "./LearnerSupportScreen.module.css";

/* ---------------- Icons ---------------- */
const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
};

const ChatIcon = () => (
  <svg {...iconProps}>
    <path d="M21 12a8 8 0 0 1-11.4 7.2L4 20l1-4.2A8 8 0 1 1 21 12z" />
  </svg>
);
const MentorIcon = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20a8 8 0 0 1 16 0" />
  </svg>
);
const TutorIcon = () => (
  <svg {...iconProps}>
    <path d="M22 10 12 5 2 10l10 5 10-5z" />
    <path d="M6 12v5c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-5" />
  </svg>
);
const ShieldIcon = () => (
  <svg {...iconProps}>
    <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);
const PhoneIcon = () => (
  <svg {...iconProps}>
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
  </svg>
);
const MailIcon = () => (
  <svg {...iconProps}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </svg>
);
const AlertIcon = () => (
  <svg {...iconProps}>
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
  </svg>
);
const LockIcon = () => (
  <svg {...iconProps}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);
const HeartIcon = () => (
  <svg {...iconProps}>
    <path d="M12 21s-7-4.35-9.5-8.5A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6.5C19 16.65 12 21 12 21z" />
  </svg>
);
const DocIcon = () => (
  <svg {...iconProps}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
    <path d="M9 13h6M9 17h4" />
  </svg>
);
const ArrowIcon = () => (
  <svg {...iconProps}>
    <path d="M5 12h14" />
    <path d="m13 6 6 6-6 6" />
  </svg>
);

/* ---------------- Data ---------------- */
const SAFEGUARDING_LEADS = [
  {
    role: "Designated Safeguarding Lead",
    name: "Sarah Bennett",
    initials: "SB",
    org: "GTA Doncaster",
    phone: "01302 555 140",
    email: "safeguarding@gta-doncaster.ac.uk",
  },
  {
    role: "Deputy Safeguarding Lead",
    name: "Mark Ellis",
    initials: "ME",
    org: "GTA Doncaster",
    phone: "01302 555 141",
    email: "dsl.deputy@gta-doncaster.ac.uk",
  },
];

const HELPLINES = [
  {
    name: "Childline",
    detail: "Under 19s — any worry, any time",
    number: "0800 1111",
    href: "tel:08001111",
  },
  {
    name: "Samaritans",
    detail: "Whatever you're going through",
    number: "116 123",
    href: "tel:116123",
  },
  {
    name: "NSPCC",
    detail: "Worried about a child or yourself",
    number: "0808 800 5000",
    href: "tel:08088005000",
  },
];

export function LearnerSupportScreen() {
  const { ensureThreadWithContact } = useLearnerChat();

  const openChat = (contactId: string) => () =>
    ensureThreadWithContact(contactId);

  return (
    <LearnerPageShell
      title="Support"
      description="Wellbeing, safeguarding, and everyday help — all in one place. Support chat stays private from your mentor unless you choose to involve them."
    >
      <div className={styles.page}>
        {/* Hero + urgent help */}
        <section className={styles.hero}>
          <div className={styles.heroMain}>
            <p className={styles.heroEyebrow}>You are not on your own</p>
            <h1 className={styles.heroTitle}>Support &amp; wellbeing</h1>
            <p className={styles.heroText}>
              Whether it&apos;s your apprenticeship, life at work, or how
              you&apos;re feeling — there&apos;s always someone here to help. Reach
              out however feels easiest.
            </p>
            <div className={styles.heroChips}>
              <span className={styles.heroChip}>
                <HeartIcon /> Confidential
              </span>
              <span className={styles.heroChip}>
                <ShieldIcon /> Safe &amp; supported
              </span>
              <span className={styles.heroChip}>
                <ChatIcon /> Talk any time
              </span>
            </div>
          </div>

          <div className={styles.urgent}>
            <span className={styles.urgentHead}>
              <AlertIcon /> Need help right now?
            </span>
            <p className={styles.urgentText}>
              Talk to a trusted adult, message Safeguarding below, or call
              Samaritans any time. If someone is in immediate danger, use
              emergency services.
            </p>
            <div className={styles.urgentRow}>
              <a className={styles.urgentBtn} href="tel:116123">
                <PhoneIcon /> Samaritans 116 123
              </a>
              <a
                className={styles.urgentBtn}
                data-variant="ghost"
                href="/learner/messages"
                onClick={openChat("contact-safeguarding-dsl")}
              >
                <ShieldIcon /> Message Safeguarding
              </a>
            </div>
          </div>
        </section>

        {/* Ways to get help */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Ways to get help</h2>
          </div>
          <p className={styles.sectionSub}>
            Start a conversation with the right person for what you need.
          </p>

          <div className={styles.cardGrid}>
            <Link
              className={styles.helpCard}
              data-tone="red"
              href="/learner/messages"
              onClick={openChat("contact-support-gta")}
            >
              <span className={styles.iconChip}>
                <ChatIcon />
              </span>
              <span className={styles.helpCardBody}>
                <strong>GTA Support chat</strong>
                <span>
                  Welfare, Ask GTA questions, and navigating your
                  apprenticeship.
                </span>
              </span>
              <span className={styles.privacyTag}>
                <LockIcon /> Private from your mentor
              </span>
              <span className={styles.helpCardCta}>
                Open Support chat <ArrowIcon />
              </span>
            </Link>

            <Link
              className={styles.helpCard}
              data-tone="navy"
              href="/learner/messages"
              onClick={openChat(ALEX_PROFILE.mentorId)}
            >
              <span className={styles.iconChip}>
                <MentorIcon />
              </span>
              <span className={styles.helpCardBody}>
                <strong>Progress mentor</strong>
                <span>
                  {ALEX_PROFILE.mentorName} — day-to-day pastoral and progress
                  questions.
                </span>
              </span>
              <span className={styles.helpCardCta}>
                Message mentor <ArrowIcon />
              </span>
            </Link>

            <Link
              className={styles.helpCard}
              data-tone="green"
              href="/learner/messages"
              onClick={openChat(ALEX_PROFILE.tutorId)}
            >
              <span className={styles.iconChip}>
                <TutorIcon />
              </span>
              <span className={styles.helpCardBody}>
                <strong>Tutor</strong>
                <span>
                  {ALEX_PROFILE.tutorName} — academic and workshop questions.
                </span>
              </span>
              <span className={styles.helpCardCta}>
                Message tutor <ArrowIcon />
              </span>
            </Link>

            <Link
              className={styles.helpCard}
              data-tone="teal"
              href="/learner/messages"
              onClick={openChat("contact-safeguarding-dsl")}
            >
              <span className={styles.iconChip}>
                <ShieldIcon />
              </span>
              <span className={styles.helpCardBody}>
                <strong>Safeguarding</strong>
                <span>
                  Report a concern or talk privately with the Safeguarding
                  team.
                </span>
              </span>
              <span className={styles.privacyTag}>
                <LockIcon /> Private from mentor &amp; tutor
              </span>
              <span className={styles.helpCardCta}>
                Open Safeguarding chat <ArrowIcon />
              </span>
            </Link>
          </div>
        </section>

        {/* Safeguarding */}
        <section className={styles.safeguard}>
          <div className={styles.safeguardHead}>
            <span className={styles.safeguardBadge}>
              <ShieldIcon />
            </span>
            <div className={styles.safeguardHeadText}>
              <h2>Safeguarding</h2>
              <p>
                Safeguarding means keeping you safe from harm, abuse, bullying,
                or neglect — at GTA, at work, or at home. If something
                doesn&apos;t feel right for you or someone you know, tell a
                Safeguarding Lead. You will be listened to, taken seriously, and
                kept informed.
              </p>
            </div>
          </div>

          <div className={styles.sgGrid}>
            {SAFEGUARDING_LEADS.map((lead) => (
              <div key={lead.email} className={styles.sgContact}>
                <div className={styles.sgContactTop}>
                  <span className={styles.sgAvatar}>{lead.initials}</span>
                  <div>
                    <div className={styles.sgRole}>
                      <ShieldIcon /> {lead.role}
                    </div>
                    <div className={styles.sgName}>{lead.name}</div>
                    <div className={styles.sgOrg}>{lead.org}</div>
                  </div>
                </div>
                <div className={styles.sgActions}>
                  <a
                    className={styles.sgAction}
                    href={`tel:${lead.phone.replace(/\s+/g, "")}`}
                  >
                    <PhoneIcon /> {lead.phone}
                  </a>
                  <a className={styles.sgAction} href={`mailto:${lead.email}`}>
                    <MailIcon /> Email
                  </a>
                  <Link
                    className={styles.sgAction}
                    href="/learner/messages"
                    onClick={openChat("contact-safeguarding-dsl")}
                  >
                    <ChatIcon /> Chat
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.helplines}>
            <p className={styles.helplinesTitle}>Free, confidential helplines</p>
            <div className={styles.helplineGrid}>
              {HELPLINES.map((line) => (
                <a key={line.name} className={styles.helpline} href={line.href}>
                  <span className={styles.helplineIcon}>
                    <PhoneIcon />
                  </span>
                  <span className={styles.helplineMain}>
                    <strong>{line.name}</strong>
                    <span>{line.detail}</span>
                  </span>
                  <span className={styles.helplineNumber}>{line.number}</span>
                </a>
              ))}
            </div>
          </div>

          <div className={styles.policyRow}>
            <Link className={styles.policyLink} href="/learner/support">
              <DocIcon /> Read the GTA safeguarding policy
            </Link>
          </div>
        </section>

        {/* Privacy note */}
        <p className={styles.note}>
          <LockIcon />
          <span>
            Confidential staff case notes and internal welfare assessments stay
            with Support and authorised handlers. This page never shows those
            records.
          </span>
        </p>
      </div>
    </LearnerPageShell>
  );
}
