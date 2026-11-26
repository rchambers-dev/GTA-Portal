/** Log the real failure and return a message safe to show in the browser. */

export function clientError(summary: string, detail?: unknown): string {
  if (detail !== undefined) console.error(summary, detail);
  else console.error(summary);
  return summary;
}
