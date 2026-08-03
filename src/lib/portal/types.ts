/**
 * Portal-wide session and workspace types.
 * Used by shell/adapters — not coupled to apprentice-lifecycle feature UI.
 */

export type WorkspaceId =
  | "apprentice"
  | "employer"
  | "staff"
  | "quality"
  | "management"
  | "administration"
  | "safeguarding";

export type PortalAccount = {
  id: string;
  name: string;
  initials: string;
  email: string;
  username?: string;
  baseRole: string;
  responsibilities: string[];
  department?: string;
  workspace: WorkspaceId;
  permissions: string[];
  departmentScope?: string[];
  programmeScope?: string[];
  moduleScope?: string[];
  /** Linked apprentices.id when this login is an apprentice portal account. */
  linkedApprenticeId?: string | null;
  /**
   * Cohort delivery spine for the linked apprentice (groups vs blocks).
   * Drives college nav / task UI. Defaults to groups when unknown.
   */
  deliverySpine?: "groups" | "blocks";
};

export type TemporaryAssignment = {
  id: string;
  userId: string;
  responsibility: string;
  permissions: string[];
  programmeScope?: string[];
  departmentScope?: string[];
  startsAt: string;
  expiresAt: string;
  grantedBy: string;
  grantedByName: string;
  revokedAt?: string | null;
};

export type PortalAuditEvent = {
  id: string;
  occurredAt: string;
  actorId: string;
  actorName: string;
  action: string;
  summary: string;
  targetUserId?: string;
  metadata?: Record<string, string>;
};

export type EffectiveSession = {
  account: PortalAccount;
  permissions: string[];
  activeTemporaryAssignments: TemporaryAssignment[];
  temporaryAccessLabels: string[];
};

export type NavItem = {
  href: string;
  label: string;
  permission: string;
};

export type NavSection = {
  title?: string;
  items: NavItem[];
};
