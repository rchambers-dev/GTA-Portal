/**
 * Sign-in captcha stays off unless this is exactly "true".
 * Turn it back on with NEXT_PUBLIC_HCAPTCHA_ENABLED=true and the site key.
 */
export function hcaptchaEnabled(
  value: string | undefined = process.env.NEXT_PUBLIC_HCAPTCHA_ENABLED,
): boolean {
  return value?.trim().toLowerCase() === "true";
}
