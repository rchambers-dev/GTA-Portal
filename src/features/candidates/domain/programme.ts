const PROGRAMME_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The add form submits a programmes.id. A display name is never a programme. */
export function programmeChoiceId(value: string | null | undefined): string | null {
  const id = (value ?? "").trim();
  return PROGRAMME_ID.test(id) ? id : null;
}

export type ApplicantEntry = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  firstContact: string;
  programmeId: string | null;
  centreId: string | null;
  sourceId: string | null;
};

/** What the add form must send before a row is inserted. Nothing is written here. */
export function applicantEntryError(entry: ApplicantEntry): string | null {
  if (!entry.firstName.trim() || !entry.lastName.trim() || !entry.email.trim() || !entry.phone.trim() || !entry.firstContact.trim()) {
    return "First name, last name, email, phone and the original first-contact date are required.";
  }
  if (!entry.programmeId) return "Choose a programme.";
  if (!entry.centreId) return "Choose a centre.";
  if (!entry.sourceId) return "Choose a source.";
  return null;
}
