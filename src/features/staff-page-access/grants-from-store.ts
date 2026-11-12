import type { EffectiveSession } from "@/lib/portal/types";
import { pageGrantSnapshot } from "./enforce";
import { loadPageAccessRecord, PageAccessConfigUnavailable } from "./store";

/** Broken config closes staff access. A missing document stays unconfigured and legacy-open. */
export async function pageGrantsFromStore(
  account: { id: string; workspace: EffectiveSession["account"]["workspace"] },
) {
  try {
    const loaded = await loadPageAccessRecord();
    return pageGrantSnapshot(loaded.config, account);
  } catch (error) {
    if (error instanceof PageAccessConfigUnavailable) {
      if (account.workspace === "apprentice" || account.workspace === "employer") {
        return { configured: false, readable: [], editable: [] };
      }
      return { configured: true, readable: [], editable: [] };
    }
    throw error;
  }
}
