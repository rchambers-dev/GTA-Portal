"use client";

import { LearnerPageShell } from "@/features/learner-portal/components/LearnerPageShell";
import styles from "./SharedDriveScreen.module.css";

export type SharedDriveAudience =
  | "administration"
  | "management"
  | "staff"
  | "quality";

const AUDIENCE_COPY = {
  administration: {
    eyebrow: "Administration",
    description:
      "Open GTA’s tenant Shared Drive without leaving the portal. Folder access follows your Microsoft account — the same permissions you already have in the tenant.",
  },
  management: {
    eyebrow: "Management",
    description:
      "Policies, templates, and shared packs for leadership. Access is controlled by your Microsoft tenant membership, not a second set of portal passwords.",
  },
  staff: {
    eyebrow: "Staff",
    description:
      "Teaching and mentor files from the GTA Shared Drive, inside your workspace. You only see folders your tenant account is allowed to open.",
  },
  quality: {
    eyebrow: "Quality",
    description:
      "Quality packs and shared evidence folders from the tenant Shared Drive. Permissions stay with Microsoft — this page is the in-portal door.",
  },
} as const;

/**
 * Shared page template — same visual frame in every workspace.
 * Tenant SSO will later power the live embed; until then this frames the intent.
 */
export function SharedDriveScreen({
  audience = "administration",
}: {
  audience?: SharedDriveAudience;
}) {
  const copy = AUDIENCE_COPY[audience];

  return (
    <LearnerPageShell
      eyebrow={copy.eyebrow}
      title="Shared Drive"
      description={copy.description}
      fill
      compactHeader
    >
      <div className={styles.page}>
        <section className={styles.frame} aria-label="Shared Drive">
          <header className={styles.frameBar}>
            <div className={styles.frameIdentity}>
              <span className={styles.frameMark} aria-hidden />
              <div>
                <p className={styles.frameTitle}>GTA Shared Drive</p>
                <p className={styles.frameMeta}>
                  Microsoft tenant · signed-in access
                </p>
              </div>
            </div>
            <p className={styles.frameHint}>
              Same view across environments — only the workspace label changes
            </p>
          </header>

          <div className={styles.embed}>
            <div className={styles.embedPlaceholder}>
              <p className={styles.embedEyebrow}>Tenant connect</p>
              <h2 className={styles.embedTitle}>
                Drive opens here when Microsoft sign-in is live
              </h2>
              <p className={styles.embedBody}>
                This panel is the shared embed shell for every environment.
                Folder rights come from your tenant account — admins, managers,
                and staff each see what they’re already allowed to see in
                SharePoint / OneDrive.
              </p>
              <ul className={styles.embedList}>
                <li>No separate document login</li>
                <li>Learner pack files stay on Learners</li>
                <li>Org templates and policies live here</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </LearnerPageShell>
  );
}
