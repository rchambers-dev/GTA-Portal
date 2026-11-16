export const TABLES_MISSING =
  "The candidates tables are not on the database yet. Nothing was changed. Reiss needs to approve the migration first.";

export function tablesMissing(message: string | undefined, code?: string): boolean {
  return code === "PGRST205" || /does not exist|schema cache|could not find the relation/i.test(message || "");
}
