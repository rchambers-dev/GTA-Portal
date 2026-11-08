const PROFILE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Blank is a deliberate unattributed save. Any other non-UUID is rejected. */
export function canonicalActorId(value: string | null | undefined): string | null {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  if (!PROFILE_ID.test(trimmed)) {
    throw Object.assign(new Error("Actor must be a Portal profile id."), { status: 400 });
  }
  return trimmed;
}
