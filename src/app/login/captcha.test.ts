import { afterEach, describe, expect, it } from "vitest";
import { hcaptchaEnabled } from "./captcha";

const original = process.env.NEXT_PUBLIC_HCAPTCHA_ENABLED;

afterEach(() => {
  if (original === undefined) delete process.env.NEXT_PUBLIC_HCAPTCHA_ENABLED;
  else process.env.NEXT_PUBLIC_HCAPTCHA_ENABLED = original;
});

describe("hcaptchaEnabled", () => {
  it("stays off when the flag is missing or any value other than true", () => {
    delete process.env.NEXT_PUBLIC_HCAPTCHA_ENABLED;
    expect(hcaptchaEnabled()).toBe(false);
    expect(hcaptchaEnabled("")).toBe(false);
    expect(hcaptchaEnabled("false")).toBe(false);
    expect(hcaptchaEnabled(" TRUE ")).toBe(true);
  });
});
