import { describe, expect, it } from "vitest";
import { explainAddressBookError, explainSignInError } from "./errors";

describe("companion error copy", () => {
  it("tells the owner when the address-book migration has not been applied", () => {
    expect(explainAddressBookError("Could not find the table public.portal_address_book", "PGRST205")).toBe(
      "The address book is not available yet. Apply the portal_address_book migration in Supabase, then try again.",
    );
  });

  it("does not pretend a captcha failure is a wrong password", () => {
    expect(explainSignInError("captcha verification process failed")).toContain("security check");
  });
});
