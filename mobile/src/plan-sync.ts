import type { DraftResult, DeviceDraft } from "./map-contact";

export type SyncPlan = {
  add: DeviceDraft[];
  update: { deviceContactId: string; draft: DeviceDraft }[];
  skipped: { contactKey: string; reason: "blank-name" | "duplicate" }[];
};

export type SyncSummary = {
  added: number;
  updated: number;
  skipped: number;
  failed: number;
  missingPhone: number;
  missingEmail: number;
};

export function planSync(input: {
  drafts: readonly DraftResult[];
  mapping: Readonly<Record<string, string>>;
  existingDeviceIds: ReadonlySet<string>;
  taggedDeviceIds: ReadonlyMap<string, string>;
}): SyncPlan {
  const add: DeviceDraft[] = [];
  const update: { deviceContactId: string; draft: DeviceDraft }[] = [];
  const skipped: SyncPlan["skipped"] = [];
  const seen = new Set<string>();

  for (const item of input.drafts) {
    const contactKey = item.ok ? item.draft.contactKey : item.contactKey;
    if (contactKey && seen.has(contactKey)) {
      skipped.push({ contactKey, reason: "duplicate" });
      continue;
    }
    if (contactKey) seen.add(contactKey);
    if (!item.ok) {
      skipped.push({ contactKey, reason: item.reason });
      continue;
    }

    const deviceContactId = resolveDeviceId(
      item.draft.contactKey,
      input.mapping,
      input.existingDeviceIds,
      input.taggedDeviceIds,
    );
    if (deviceContactId) update.push({ deviceContactId, draft: item.draft });
    else add.push(item.draft);
  }

  return { add, update, skipped };
}

export function summarisePlan(plan: SyncPlan, failed = 0): SyncSummary {
  const written = [...plan.add, ...plan.update.map((item) => item.draft)];
  return {
    added: plan.add.length,
    updated: plan.update.length,
    skipped: plan.skipped.length,
    failed,
    missingPhone: written.filter((draft) => draft.missingPhone).length,
    missingEmail: written.filter((draft) => draft.missingEmail).length,
  };
}

export function formatSyncedAt(iso: string | null): string {
  if (!iso) return "Not synced yet";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Not synced yet";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function resolveDeviceId(
  contactKey: string,
  mapping: Readonly<Record<string, string>>,
  existingDeviceIds: ReadonlySet<string>,
  taggedDeviceIds: ReadonlyMap<string, string>,
): string | null {
  const mapped = mapping[contactKey];
  if (mapped && existingDeviceIds.has(mapped)) return mapped;
  const tagged = taggedDeviceIds.get(contactKey);
  if (tagged && existingDeviceIds.has(tagged)) return tagged;
  return null;
}
