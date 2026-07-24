import type { DemoAuditEvent, TemporaryAssignment } from "@/lib/portal/types";

export const DEMO_COOKIE_ACCOUNT = "gta-demo-active-account";
export const DEMO_COOKIE_ASSIGNMENTS = "gta-demo-assignments";

export const DEMO_STORAGE_ACCOUNT = "gta-demo-active-account";
export const DEMO_STORAGE_ASSIGNMENTS = "gta-demo-assignments";
export const DEMO_STORAGE_AUDIT = "gta-demo-audit-log";

export function isDemoModeEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "false") return false;
  return (
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.NODE_ENV === "development" ||
    process.env.VERCEL === "1"
  );
}

export function parseAssignmentsCookie(value: string | undefined): TemporaryAssignment[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as TemporaryAssignment[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function serializeAssignments(assignments: TemporaryAssignment[]): string {
  return encodeURIComponent(JSON.stringify(assignments));
}

export function parseAuditLog(value: string | null): DemoAuditEvent[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as DemoAuditEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function createAuditEvent(
  partial: Omit<DemoAuditEvent, "id" | "occurredAt">,
): DemoAuditEvent {
  return {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    occurredAt: new Date().toISOString(),
    ...partial,
  };
}
