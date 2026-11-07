/**
 * Legacy enrolment rows keep employer_id as text.
 * When that value is the employers catalogue uuid, also store employer_uuid
 * so the foreign key and the text id describe the same relationship.
 * Non-uuid legacy text is left without a foreign key rather than guessed.
 */
export function employerUuidFromLegacyId(
  employerId: string | null | undefined,
): string | null {
  const value = (employerId ?? "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
    ? value
    : null;
}
