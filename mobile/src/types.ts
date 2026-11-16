export const CONTACT_GROUPS = ["learner", "employer", "tutor", "staff"] as const;

export type ContactGroup = (typeof CONTACT_GROUPS)[number];

export const GROUP_COPY: Record<ContactGroup, { title: string; hint: string }> = {
  learner: { title: "Learners", hint: "Apprentices" },
  employer: { title: "Employers", hint: "Workplace contacts" },
  tutor: { title: "Tutors", hint: "Filed with staff" },
  staff: { title: "Staff", hint: "Other Portal accounts" },
};

export type AddressBookRow = {
  contactGroup: ContactGroup;
  sourceId: string;
  contactKey: string;
  givenName: string;
  middleName: string | null;
  familyName: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  organisation: string | null;
  jobTitle: string | null;
  detail: string | null;
};

export type RawAddressBookRow = {
  contact_group: string | null;
  source_id: string | null;
  contact_key: string | null;
  given_name: string | null;
  middle_name: string | null;
  family_name: string | null;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  organisation: string | null;
  job_title: string | null;
  detail: string | null;
};

export function isContactGroup(value: string): value is ContactGroup {
  return (CONTACT_GROUPS as readonly string[]).includes(value);
}
