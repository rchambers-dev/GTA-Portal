import { redirect } from "next/navigation";

export function getUnauthenticatedRedirect(target?: string): string {
  const next = target?.trim();
  if (!next) return "/login";
  return `/login?next=${encodeURIComponent(next)}`;
}

export function redirectIfUnauthenticated(target?: string): never {
  redirect(getUnauthenticatedRedirect(target));
}
