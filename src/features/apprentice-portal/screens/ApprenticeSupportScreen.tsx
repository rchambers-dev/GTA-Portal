"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SafeguardingLead } from "@/features/apprentice-portal/domain/safeguarding-leads";
import { ApprenticePageShell } from "../components/ApprenticePageShell";
import { useApprenticeChat } from "../components/ApprenticeChatProvider";
import { useApprenticePortalProfile } from "../hooks/useApprenticePortalProfile";
import styles from "./ApprenticeSupportScreen.module.css";

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

export type SupportAudience =
  | "apprentice"
  | "employer"
  | "administration"
  | "management";

const AUDIENCE_COPY = {
  apprentice: {
    eyebrow: "Apprentice portal",
    title: "Support",
    description:
      "Wellbeing, safeguarding, and everyday help — all in one place. Support chat stays private from your mentor unless you choose to involve them.",
    heroEyebrow: "You are not on your own",
    heroTitle: "Support & Wellbeing",
    heroText:
      "Whether it's your apprenticeship, life at work, or how you're feeling — there's always someone here to help. Reach out however feels easiest.",
    chipPrimary: "Confidential",
    urgentText:
      "Talk to a trusted adult, message Safeguarding below, or call Samaritans any time. If someone is in immediate danger, use emergency services.",
    waysSub: "Start a conversation with the right person for what you need.",
    askTitle: "GTA Support chat",
    askBody:
      "Welfare, Ask GTA questions, and navigating your apprenticeship.",
    privacy: "Private from your mentor",
    messagesHref: "/apprentice/messages",
    supportHref: "/apprentice/support",
  },
  employer: {
    eyebrow: "Employer workspace",
    title: "Support",
    description:
      "Ask GTA, raise a concern, or get help with an apprentice — GTA handles sensitive cases first. The apprentice is not contacted directly from employer concerns.",
    heroEyebrow: "We're here for employers too",
    heroTitle: "Support & Concerns",
    heroText:
      "Whether you need clarity on progress, training arrangements, or you're worried about an apprentice — reach out to GTA. Sensitive concerns stay with GTA until the right next step is agreed.",
    chipPrimary: "GTA-first",
    urgentText:
      "If an apprentice or colleague is at risk, message Safeguarding below or call Samaritans. If someone is in immediate danger, use emergency services.",
    waysSub: "Start a conversation with the right GTA contact for what you need.",
    askTitle: "Ask GTA",
    askBody:
      "General questions about delivery, reviews, attendance, or employer obligations.",
    privacy: "Handled by GTA first",
    messagesHref: "/employer/messages",
    supportHref: "/employer/support",
  },
  administration: {
    eyebrow: "Administration",
    title: "Safeguarding",
    description:
      "Shared safeguarding contacts and urgent help — available from every workspace. Use this when an apprentice or employer concern needs a safe, confidential route.",
    heroEyebrow: "Shared safeguarding route",
    heroTitle: "Safeguarding & Welfare",
    heroText:
      "If something in enrolment, employer records, or day-to-day admin raises a welfare concern, contact Safeguarding here. Sensitive cases stay with GTA leads until the right next step is agreed.",
    chipPrimary: "Confidential",
    urgentText:
      "If an apprentice or colleague is at risk, message Safeguarding below or call Samaritans. If someone is in immediate danger, use emergency services.",
    waysSub: "Start a conversation with Safeguarding or GTA support.",
    askTitle: "GTA Support chat",
    askBody:
      "General admin questions that need a welfare-aware response from GTA.",
    privacy: "Handled by GTA first",
    messagesHref: "/administration/messages",
    supportHref: "/administration/safeguarding",
  },
  management: {
    eyebrow: "Management",
    title: "Safeguarding",
    description:
      "Shared safeguarding contacts and urgent help — available from every workspace. Use this when an apprentice, staff, or employer concern needs a safe, confidential route.",
    heroEyebrow: "Shared safeguarding route",
    heroTitle: "Safeguarding & Welfare",
    heroText:
      "If something in operations, staffing, or apprentice delivery raises a welfare concern, contact Safeguarding here. Sensitive cases stay with GTA leads until the right next step is agreed.",
    chipPrimary: "Confidential",
    urgentText:
      "If an apprentice or colleague is at risk, message Safeguarding below or call Samaritans. If someone is in immediate danger, use emergency services.",
    waysSub: "Start a conversation with Safeguarding or GTA support.",
    askTitle: "GTA Support chat",
    askBody:
      "Management questions that need a welfare-aware response from GTA.",
    privacy: "Handled by GTA first",
    messagesHref: "/management/messages",
    supportHref: "/management/safeguarding",
  },
} as const;

export function ApprenticeSupportScreen({
  audience = "apprentice",
}: {
  /** Shared Support / Safeguarding page — copy and message routes by workspace. */
  audience?: SupportAudience;
} = {}) {
  const { profile } = useApprenticePortalProfile();
  const { ensureThreadWithContact } = useApprenticeChat();
  const [leads, setLeads] = useState<SafeguardingLead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [leadsError, setLeadsError] = useState<string | null>(null);
  const copy = AUDIENCE_COPY[audience];
  const isEmployer = audience === "employer";
  const isAdministration =
    audience === "administration" || audience === "management";
  const messagesHref = copy.messagesHref;
  const supportHref = copy.supportHref;

  useEffect(() => {
    let cancelled = false;
    setLeadsLoading(true);
    setLeadsError(null);
    fetch("/api/safeguarding/leads")
      .then(async (res) => {
        const data = (await res.json()) as {
          leads?: SafeguardingLead[];
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error || "Unable to load safeguarding leads.");
        }
        if (!cancelled) {
          setLeads(data.leads ?? []);
          setLeadsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLeads([]);
          setLeadsError(
            err instanceof Error
              ? err.message
              : "Unable to load safeguarding leads.",
          );
          setLeadsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openChat = (contactId: string) => () =>
    ensureThreadWithContact(contactId);

  return (
    <ApprenticePageShell
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
    >
      <div className={styles.page}>
        <section className={styles.hero}>
          <div className={styles.heroMain}>
            <p className={styles.heroEyebrow}>{copy.heroEyebrow}</p>
            <h1 className={styles.heroTitle}>{copy.heroTitle}</h1>
            <p className={styles.heroText}>{copy.heroText}</p>
            <div className={styles.heroChips}>
              <span className={styles.heroChip}>
                <HeartIcon /> {copy.chipPrimary}
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
            <p className={styles.urgentText}>{copy.urgentText}</p>
            <div className={styles.urgentRow}>
              <a className={styles.urgentBtn} href="tel:116123">
                <PhoneIcon /> Samaritans 116 123
              </a>
              <a
                className={styles.urgentBtn}
                data-variant="ghost"
                href={messagesHref}
                onClick={openChat("contact-safeguarding-dsl")}
              >
                <ShieldIcon /> Message Safeguarding
              </a>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Ways to get help</h2>
          </div>
          <p className={styles.sectionSub}>{copy.waysSub}</p>

          <div className={styles.cardGrid}>
            <Link
              className={styles.helpCard}
              data-tone="red"
              href={messagesHref}
              onClick={openChat("contact-support-gta")}
            >
              <span className={styles.iconChip}>
                <ChatIcon />
              </span>
              <span className={styles.helpCardBody}>
                <strong>{copy.askTitle}</strong>
                <span>{copy.askBody}</span>
              </span>
              <span className={styles.privacyTag}>
                <LockIcon /> {copy.privacy}
              </span>
              <span className={styles.helpCardCta}>
                Open Support chat <ArrowIcon />
              </span>
            </Link>

            {!isAdministration ? (
              <Link
                className={styles.helpCard}
                data-tone="navy"
                href={messagesHref}
                onClick={openChat(profile.mentorId)}
              >
                <span className={styles.iconChip}>
                  <MentorIcon />
                </span>
                <span className={styles.helpCardBody}>
                  <strong>Progress mentor</strong>
                  <span>
                    {isEmployer
                      ? `${profile.mentorName} — progress, reviews, and workplace arrangements for your apprentices.`
                      : `${profile.mentorName} — day-to-day pastoral and progress questions.`}
                  </span>
                </span>
                <span className={styles.helpCardCta}>
                  Message mentor <ArrowIcon />
                </span>
              </Link>
            ) : null}

            {isEmployer ? (
              <Link
                className={styles.helpCard}
                data-tone="green"
                href={messagesHref}
                onClick={openChat("contact-support-gta")}
              >
                <span className={styles.iconChip}>
                  <TutorIcon />
                </span>
                <span className={styles.helpCardBody}>
                  <strong>Clarify Apprentice Progress</strong>
                  <span>
                    Request clarification on progress summaries visible to
                    employers — GTA will respond.
                  </span>
                </span>
                <span className={styles.helpCardCta}>
                  Ask about progress <ArrowIcon />
                </span>
              </Link>
            ) : !isAdministration ? (
              <Link
                className={styles.helpCard}
                data-tone="green"
                href={messagesHref}
                onClick={openChat(profile.tutorId)}
              >
                <span className={styles.iconChip}>
                  <TutorIcon />
                </span>
                <span className={styles.helpCardBody}>
                  <strong>Tutor</strong>
                  <span>
                    {profile.tutorName} — academic and workshop questions.
                  </span>
                </span>
                <span className={styles.helpCardCta}>
                  Message tutor <ArrowIcon />
                </span>
              </Link>
            ) : null}

            <Link
              className={styles.helpCard}
              data-tone="teal"
              href={messagesHref}
              onClick={openChat("contact-safeguarding-dsl")}
            >
              <span className={styles.iconChip}>
                <ShieldIcon />
              </span>
              <span className={styles.helpCardBody}>
                <strong>
                  {isEmployer ? "Raise a concern" : "Safeguarding"}
                </strong>
                <span>
                  {isEmployer
                    ? "Raise a welfare or workplace concern about an apprentice. GTA handles this first — the apprentice is not contacted directly from this route."
                    : isAdministration
                      ? "Report a welfare concern arising from enrolment, employer, or apprentice admin work. GTA Safeguarding leads handle next steps."
                      : "Report a concern or talk privately with the Safeguarding team."}
                </span>
              </span>
              <span className={styles.privacyTag}>
                <LockIcon />
                {isEmployer
                  ? " GTA first — apprentice not auto-contacted"
                  : isAdministration
                    ? " Confidential — DSL first"
                    : " Private from mentor & tutor"}
              </span>
              <span className={styles.helpCardCta}>
                {isEmployer ? (
                  <>
                    Open concern chat <ArrowIcon />
                  </>
                ) : (
                  <>
                    Open Safeguarding chat <ArrowIcon />
                  </>
                )}
              </span>
            </Link>
          </div>
        </section>

        <section className={styles.safeguard}>
          <div className={styles.safeguardHead}>
            <span className={styles.safeguardBadge}>
              <ShieldIcon />
            </span>
            <div className={styles.safeguardHeadText}>
              <h2>Safeguarding</h2>
              <p>
                {isEmployer
                  ? "Safeguarding means keeping apprentices safe from harm, abuse, bullying, or neglect — at GTA, at work, or at home. If something doesn't feel right about an apprentice or colleague, tell a Safeguarding Lead. You will be listened to and GTA will decide next steps."
                  : isAdministration
                    ? "Safeguarding means keeping apprentices and colleagues safe from harm, abuse, bullying, or neglect. If something in admin work doesn't feel right, tell a Safeguarding Lead. You will be listened to and GTA will decide next steps."
                    : "Safeguarding means keeping you safe from harm, abuse, bullying, or neglect — at GTA, at work, or at home. If something doesn't feel right for you or someone you know, tell a Safeguarding Lead. You will be listened to, taken seriously, and kept informed."}
              </p>
            </div>
          </div>

          <div className={styles.sgGrid}>
            {leadsLoading ? (
              <p className={styles.sgOrg}>Loading safeguarding contacts…</p>
            ) : null}
            {leadsError ? (
              <p className={styles.sgOrg}>{leadsError}</p>
            ) : null}
            {!leadsLoading && !leadsError && leads.length === 0 ? (
              <p className={styles.sgOrg}>
                No safeguarding leads are currently listed. Message Safeguarding
                or ask reception for the duty DSL.
              </p>
            ) : null}
            {leads.map((lead) => (
              <div key={lead.id} className={styles.sgContact}>
                <div className={styles.sgContactTop}>
                  <span className={styles.sgAvatar}>{lead.initials}</span>
                  <div>
                    <div className={styles.sgRole}>
                      <ShieldIcon /> {lead.role}
                    </div>
                    <div className={styles.sgName}>{lead.name}</div>
                    <div className={styles.sgOrg}>{lead.org}</div>
                    <p className={styles.sgEmail}>{lead.email}</p>
                  </div>
                </div>
                <div className={styles.sgActions}>
                  <a
                    className={styles.sgAction}
                    href={`mailto:${lead.email}`}
                    title={lead.email}
                  >
                    <MailIcon /> Email
                  </a>
                  <Link
                    className={styles.sgAction}
                    href={messagesHref}
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
            <Link className={styles.policyLink} href={supportHref}>
              <DocIcon /> Read the GTA safeguarding policy
            </Link>
          </div>
        </section>

        <p className={styles.note}>
          <LockIcon />
          <span>
            {isEmployer
              ? "Internal GTA case notes and safeguarding detail are never shown in employer views. Concerns are handled by GTA before any apprentice contact."
              : "Confidential staff case notes and internal welfare assessments stay with Support and authorised handlers. This page never shows those records."}
          </span>
        </p>
      </div>
    </ApprenticePageShell>
  );
}
