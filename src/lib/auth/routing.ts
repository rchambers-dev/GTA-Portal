import { redirect } from "next/navigation";
import { isDemoModeEnabled } from "@/lib/env/portal";

export function getUnauthenticatedRedirect(target?: string): string {
  if (isDemoModeEnabled()) return "/";
  const next = target?.trim();
  if (!next) return "/login";
  return `/login?next=${encodeURIComponent(next)}`;
}

export function redirectIfUnauthenticated(target?: string): never {
  redirect(getUnauthenticatedRedirect(target));
}
