import type {
  LrsFindUlnResult,
  LrsGetPlrResult,
  LrsPlrPort,
} from "@/features/apprentice-portal/ports/lrs-plr";

/**
 * Standalone mock of LRS Find ULN + Get Apprentice Learning Events.
 * Returns not_found until live SOAP LRS is configured.
 */
export const mockLrsPlrAdapter: LrsPlrPort = {
  mode: "mock",

  async findUln(identity) {
    const given = identity.givenName.trim().toLowerCase();
    const family = identity.familyName.trim().toLowerCase();
    if (!given || !family) {
      return {
        status: "not_found",
        message: "Given name and family name are required to find a ULN.",
      };
    }
    return {
      status: "not_found",
      message:
        "No ULN found in the mock LRS for this identity. Enter the ULN manually.",
    };
  },

  async getApprenticeLearningEvents(identity): Promise<LrsGetPlrResult> {
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

    return {
      status: "not_verified",
      message:
        "Mock LRS has no PLR for this identity. Live LRS SOAP integration is required for real lookups.",
    };
  },
};

/**
 * Placeholder for production SOAP LRS adapter.
 * Requires LRB registration, client certificate, organisation credentials, vendor ID,
 * and DfE compatibility testing before live Get Apprentice Learning Events calls.
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

  async getApprenticeLearningEvents(): Promise<LrsGetPlrResult> {
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
