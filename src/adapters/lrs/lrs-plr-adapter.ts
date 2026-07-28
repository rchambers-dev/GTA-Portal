import type {
  LrsFindUlnResult,
  LrsGetPlrResult,
  LrsLearnerIdentity,
  LrsPlrPort,
  PlrLearningRecord,
} from "@/features/learner-portal/ports/lrs-plr";

const DEMO_ULN = "1234567890";

function alexPlr(identity: LrsLearnerIdentity): PlrLearningRecord {
  const now = new Date().toISOString();
  return {
    uln: identity.uln || DEMO_ULN,
    givenName: identity.givenName,
    familyName: identity.familyName,
    dateOfBirth: identity.dateOfBirth ?? "2007-03-14",
    verified: true,
    privacyAllowsSharing: true,
    retrievedAt: now,
    vendorId: "GTA-MOCK-VENDOR",
    notes: [
      "Mock LRS response for standalone demo.",
      "Replace with SOAP Get Learner Learning Events once LRB client certificate is issued.",
    ],
    qualifications: [
      {
        id: "plr-q-gcse-eng",
        title: "GCSE English Language",
        qualificationCode: "601/4292/3",
        level: "Level 2",
        grade: "4",
        credits: null,
        awardingOrganisation: "AQA",
        previousProvider: "Doncaster Secondary Academy",
        startDate: "2021-09-01",
        endDate: "2023-06-30",
        awardDate: "2023-08-24",
        source: "national_pupil_database",
      },
      {
        id: "plr-q-gcse-maths",
        title: "GCSE Mathematics",
        qualificationCode: "601/4608/4",
        level: "Level 2",
        grade: "5",
        credits: null,
        awardingOrganisation: "Pearson Edexcel",
        previousProvider: "Doncaster Secondary Academy",
        startDate: "2021-09-01",
        endDate: "2023-06-30",
        awardDate: "2023-08-24",
        source: "national_pupil_database",
      },
      {
        id: "plr-q-gcse-sci",
        title: "GCSE Combined Science (Trilogy)",
        qualificationCode: "601/8758/X",
        level: "Level 2",
        grade: "4-4",
        credits: null,
        awardingOrganisation: "AQA",
        previousProvider: "Doncaster Secondary Academy",
        startDate: "2021-09-01",
        endDate: "2023-06-30",
        awardDate: "2023-08-24",
        source: "national_pupil_database",
      },
      {
        id: "plr-q-fs-ict",
        title: "Functional Skills ICT",
        qualificationCode: "603/4260/8",
        level: "Level 1",
        grade: "Pass",
        credits: null,
        awardingOrganisation: "City & Guilds",
        previousProvider: "Doncaster Secondary Academy",
        startDate: "2022-09-01",
        endDate: "2023-05-15",
        awardDate: "2023-06-01",
        source: "awarding_organisation",
      },
      {
        id: "plr-q-intro-auto",
        title: "Award in Introduction to the Automotive Industry",
        qualificationCode: "601/0123/4",
        level: "Entry Level 3",
        grade: "Pass",
        credits: "6",
        awardingOrganisation: "IMI Awards",
        previousProvider: "Local FE College Outreach",
        startDate: "2023-09-01",
        endDate: "2024-02-28",
        awardDate: "2024-03-12",
        source: "ilr",
      },
    ],
    participations: [
      {
        id: "plr-p-school",
        title: "Secondary education",
        provider: "Doncaster Secondary Academy",
        startDate: "2018-09-01",
        endDate: "2023-06-30",
        status: "Completed",
      },
      {
        id: "plr-p-outreach",
        title: "Automotive taster / intro award",
        provider: "Local FE College Outreach",
        startDate: "2023-09-01",
        endDate: "2024-02-28",
        status: "Completed",
      },
    ],
  };
}

/**
 * Standalone mock of LRS Find ULN + Get Learner Learning Events.
 * Matches demo learner Alex Morgan (ULN 1234567890).
 */
export const mockLrsPlrAdapter: LrsPlrPort = {
  mode: "mock",

  async findUln(identity) {
    const given = identity.givenName.trim().toLowerCase();
    const family = identity.familyName.trim().toLowerCase();
    if (given === "alex" && family === "morgan") {
      return { status: "found", uln: DEMO_ULN };
    }
    if (!given || !family) {
      return {
        status: "not_found",
        message: "Given name and family name are required to find a ULN.",
      };
    }
    return {
      status: "not_found",
      message:
        "No ULN found in the mock LRS for this identity. Enter the ULN manually or use the demo learner Alex Morgan.",
    };
  },

  async getLearnerLearningEvents(identity): Promise<LrsGetPlrResult> {
    await new Promise((r) => setTimeout(r, 350));

    const given = identity.givenName.trim();
    const family = identity.familyName.trim();
    const uln = identity.uln.replace(/\D/g, "");

    if (!given || !family || uln.length !== 10) {
      return {
        status: "not_verified",
        message:
          "LRS requires ULN (10 digits), given name and family name. Date of birth improves verification.",
      };
    }

    const isAlex =
      given.toLowerCase() === "alex" &&
      family.toLowerCase() === "morgan" &&
      uln === DEMO_ULN;

    if (!isAlex) {
      return {
        status: "not_verified",
        message:
          "Mock LRS could not verify this learner. Demo data is available for Alex Morgan / ULN 1234567890.",
      };
    }

    return { status: "ok", record: alexPlr({ ...identity, uln }) };
  },
};

/**
 * Placeholder for production SOAP LRS adapter.
 * Requires LRB registration, client certificate, organisation credentials, vendor ID,
 * and DfE compatibility testing before live Get Learner Learning Events calls.
 */
export const soapLrsPlrAdapterStub: LrsPlrPort = {
  mode: "soap",

  async findUln(): Promise<LrsFindUlnResult> {
    return {
      status: "not_found",
      message:
        "SOAP LRS adapter is not configured. Complete LRB web services onboarding first.",
    };
  },

  async getLearnerLearningEvents(): Promise<LrsGetPlrResult> {
    return {
      status: "not_configured",
      message:
        "Live LRS SOAP integration is not configured. Use the mock adapter until GTA holds an LRS client certificate, organisation credentials and vendor ID.",
    };
  },
};

export function getLrsPlrPort(): LrsPlrPort {
  // Flip to soapLrsPlrAdapterStub / real SOAP impl when credentials exist.
  return mockLrsPlrAdapter;
}
