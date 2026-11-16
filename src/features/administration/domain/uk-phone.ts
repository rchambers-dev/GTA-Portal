/**
 * Same UK and E.164 rules as mobile/src/phone.ts.
 * Keep the two copies in step. The Portal stores only the E.164 form.
 */

export type NormalisedPhone = {
  e164: string | null;
  display: string | null;
};

const E164 = /^\+[1-9]\d{7,14}$/;

export function normalisePhone(input: string | null | undefined): NormalisedPhone {
  if (input == null) return { e164: null, display: null };
  const compact = compactPhone(input);
  if (!compact) return { e164: null, display: null };

  const uk = ukE164(compact);
  if (uk) return { e164: uk, display: uk };

  if (E164.test(compact)) return { e164: compact, display: compact };

  const digits = compact.replace(/\D/g, "");
  if (digits.length < 7) return { e164: null, display: null };
  return { e164: null, display: compact.startsWith("+") ? `+${digits}` : digits };
}

export function validateContactPhone(
  value: string | null | undefined,
): { ok: true; phone: string | null } | { ok: false; error: string } {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return { ok: true, phone: null };
  const normalised = normalisePhone(trimmed);
  if (!normalised.e164) {
    return { ok: false, error: "Enter a UK phone number, such as 07700 900123." };
  }
  return { ok: true, phone: normalised.e164 };
}

function compactPhone(input: string): string {
  const withoutExtension = input.trim().replace(/\s*(?:ext\.?|extension|x)\s*\d+\s*$/i, "");
  const digits = withoutExtension.replace(/\D/g, "");
  if (!digits) return "";
  if (withoutExtension.trim().startsWith("00")) return `+${digits.slice(2)}`;
  if (withoutExtension.includes("+")) return `+${digits}`;
  return digits;
}

function ukE164(compact: string): string | null {
  if (compact.startsWith("+44")) return fromUkNational(compact.slice(3));
  if (compact.startsWith("0")) return fromUkNational(compact);
  if (/^44\d{9,11}$/.test(compact)) return fromUkNational(compact.slice(2));
  return null;
}

function fromUkNational(national: string): string | null {
  const significant = national.startsWith("0") ? national.slice(1) : national;
  if (!/^[1-9]\d{8,9}$/.test(significant)) return null;
  return `+44${significant}`;
}
