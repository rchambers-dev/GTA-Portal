import { COLLEGE_WEEKDAYS } from "@/features/administration/domain/college-days";

/**
 * Option labels copied from GTA-Onboarding-Marketing
 * src/domain/labels.ts at c92f678134499f5d23733bc24720da9971d43254.
 * Site here is the recruitment training site, not an employer yard.
 * Release day uses the portal's existing college weekdays.
 * Values start blank in this preview so a choice is not written until selected.
 */

export const TRAINING_SITES = [
  { value: "doncaster", label: "Doncaster" },
  { value: "sheffield", label: "Sheffield" },
] as const;

export const APPRENTICESHIPS = [
  { value: "autocare", label: "Autocare" },
  { value: "light_vehicle", label: "Light Vehicle" },
  { value: "heavy_vehicle", label: "Heavy Vehicle" },
  { value: "vehicle_paint", label: "Vehicle Paint" },
  { value: "vehicle_panel", label: "Vehicle Panel" },
  { value: "business_admin", label: "Business Admin" },
  { value: "customer_service", label: "Customer Service" },
] as const;

export const ENQUIRY_SOURCES = [
  { value: "website", label: "Website" },
  { value: "social_media", label: "Social media" },
  { value: "school_event", label: "School event" },
  { value: "google", label: "Google" },
  { value: "word_of_mouth", label: "Word of mouth" },
  { value: "leaflet", label: "Leaflet" },
  { value: "flyer", label: "Flyer" },
  { value: "gta_prospectus", label: "GTA prospectus" },
  { value: "other", label: "Other" },
] as const;

export const RESPONSIVENESS_OPTIONS = [
  { value: "responsive", label: "Responsive" },
  { value: "unresponsive", label: "Unresponsive" },
] as const;

export const EMPLOYER_STATUSES = [
  { value: "employer_needed", label: "Employer needed" },
  { value: "identified_unconfirmed", label: "Identified but unconfirmed" },
  { value: "confirmed", label: "Confirmed" },
] as const;

export const RELEASE_DAYS = COLLEGE_WEEKDAYS.map((day) => ({
  value: day,
  label: day,
}));

export const LEARNER_FIELD_ORDER = [
  "firstName",
  "lastName",
  "externalLearnerId",
  "site",
  "apprenticeship",
  "originalEntryDate",
  "enquirySource",
  "responsiveness",
  "employerStatus",
  "employerId",
  "intendedIntakeDate",
  "releaseDay",
  "gtaTutor",
  "apprenticeshipStartDate",
  "apprenticeshipPlannedEndDate",
  "gtaReviewer",
  "plannedReviewDate",
  "futureReviews",
  "notes",
] as const;
