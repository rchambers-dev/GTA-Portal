export type NormalisedPhone = {
  /** UK or already-international E.164. Null when the number cannot be normalised. */
  e164: string | null;
  /** A number safe to store when E.164 is not possible. Null when there is no usable number. */
  display: string | null;
};

const E164 = /^\+[1-9]\d{7,14}$/;

/**
 * Normalise a phone number to E.164 where it is a UK number or already international.
 * Empty, short, and non-numeric values produce no number so the contact can still sync.
 */
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

/** The number to write on the contact, preferring E.164. */
export function phoneToStore(input: string | null | undefined): string | null {
  const normalised = normalisePhone(input);
  return normalised.e164 ?? normalised.display;
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

/** Accept a trunk 0 plus 9 or 10 further digits, which is the usual UK length. */
function fromUkNational(national: string): string | null {
  const significant = national.startsWith("0") ? national.slice(1) : national;
  if (!/^[1-9]\d{8,9}$/.test(significant)) return null;
  return `+44${significant}`;
}
