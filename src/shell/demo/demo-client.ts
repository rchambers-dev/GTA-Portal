"use client";

import type { DemoAuditEvent, TemporaryAssignment } from "@/lib/portal/types";
import {
  DEMO_COOKIE_ACCOUNT,
  DEMO_COOKIE_ASSIGNMENTS,
  DEMO_STORAGE_ACCOUNT,
  DEMO_STORAGE_ASSIGNMENTS,
  DEMO_STORAGE_AUDIT,
  createAuditEvent,
  isDemoModeEnabled,
  parseAuditLog,
  serializeAssignments,
} from "@/adapters/fictional/demo-session";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function setCookie(name: string, value: string): void {
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

export function readDemoAccountId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(DEMO_STORAGE_ACCOUNT);
}

export function persistDemoAccountId(accountId: string): void {
  localStorage.setItem(DEMO_STORAGE_ACCOUNT, accountId);
  setCookie(DEMO_COOKIE_ACCOUNT, accountId);
}

export function readAssignments(): TemporaryAssignment[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(DEMO_STORAGE_ASSIGNMENTS);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as TemporaryAssignment[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistAssignments(assignments: TemporaryAssignment[]): void {
  localStorage.setItem(DEMO_STORAGE_ASSIGNMENTS, JSON.stringify(assignments));
  setCookie(DEMO_COOKIE_ASSIGNMENTS, serializeAssignments(assignments));
}

export function readAuditLog(): DemoAuditEvent[] {
  if (typeof window === "undefined") return [];
  return parseAuditLog(localStorage.getItem(DEMO_STORAGE_AUDIT));
}

export function appendAuditEvent(
  partial: Omit<DemoAuditEvent, "id" | "occurredAt">,
): DemoAuditEvent[] {
  const next = [...readAuditLog(), createAuditEvent(partial)];
  localStorage.setItem(DEMO_STORAGE_AUDIT, JSON.stringify(next));
  return next;
}

export function isClientDemoMode(): boolean {
  return isDemoModeEnabled();
}
