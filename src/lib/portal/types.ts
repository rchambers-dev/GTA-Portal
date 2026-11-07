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

export type PageGrantSnapshot = {
  configured: boolean;
  readable: string[];
  editable: string[];
};

export type EffectiveSession = {
  account: PortalAccount;
  permissions: string[];
  activeTemporaryAssignments: TemporaryAssignment[];
  temporaryAccessLabels: string[];
  /** Present when the server has evaluated the workspace page map. Absent means legacy access. */
  pageGrants?: PageGrantSnapshot;
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
