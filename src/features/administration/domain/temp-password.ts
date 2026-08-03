/**
 * Temporary portal passwords for apprentices (set when the account is enabled).
 * 12 characters: upper, lower, digit, and symbol — shuffled.
 */
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%&*?";

function pick(alphabet: string): string {
  const index = Math.floor(Math.random() * alphabet.length);
  return alphabet[index] ?? alphabet[0]!;
}

function shuffle(chars: string[]): string {
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = chars[i]!;
    chars[i] = chars[j]!;
    chars[j] = tmp;
  }
  return chars.join("");
}

export const TEMP_PASSWORD_LENGTH = 12;

export function generateTempPassword(
  length: number = TEMP_PASSWORD_LENGTH,
): string {
  const size = Math.max(8, Math.round(length));
  const required = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];
  const pool = `${UPPER}${LOWER}${DIGITS}${SYMBOLS}`;
  const rest = Array.from({ length: size - required.length }, () => pick(pool));
  return shuffle([...required, ...rest]);
}
