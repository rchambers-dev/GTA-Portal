export const TABLES_BANNER = "Example data: Open Days tables not created yet";
export const TABLES_SAVING = "Saving is disabled until the Open Days tables are created.";
export const FLAG_BANNER = "Example data: Open Days is switched off.";
export const FLAG_SAVING = "Saving is disabled while Open Days is switched off.";
export const ERROR_SAVING = "Saving is disabled until Open Days can be loaded.";

export function tablesMissing(message: string | undefined, code?: string): boolean {
  return (
    code === "PGRST205" ||
    code === "42P01" ||
    /does not exist|schema cache|could not find the relation|could not find the table/i.test(message || "")
  );
}

/** OPEN_DAYS_ENABLED=off|false|0 forces example data and disables saving. */
export function openDaysFeatureOff(env: Record<string, string | undefined> = process.env): boolean {
  const flag = (env.OPEN_DAYS_ENABLED ?? env.NEXT_PUBLIC_OPEN_DAYS_ENABLED ?? "").trim().toLowerCase();
  return flag === "0" || flag === "false" || flag === "off";
}

export function exampleMode(reason: "tables" | "flag") {
  if (reason === "flag") {
    return { example: true, banner: FLAG_BANNER, savingMessage: FLAG_SAVING, error: null };
  }
  return { example: true, banner: TABLES_BANNER, savingMessage: TABLES_SAVING, error: null };
}

export function liveMode() {
  return { example: false, banner: null, savingMessage: null, error: null };
}

export function errorMode(message: string) {
  return { example: false, banner: null, savingMessage: ERROR_SAVING, error: message };
}
