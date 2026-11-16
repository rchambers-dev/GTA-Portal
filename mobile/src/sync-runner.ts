import {
  createDeviceContact,
  deleteDeviceContact,
  openPortalGroup,
  readDeviceIndex,
  updateDeviceContact,
} from "./device-contacts";
import { deviceIdsToRemove, toDeviceDraft } from "./map-contact";
import { planSync, type SyncSummary } from "./plan-sync";
import type { StoredSync } from "./storage";
import type { AddressBookRow, ContactGroup } from "./types";

export async function runSync(input: {
  rows: readonly AddressBookRow[];
  groups: readonly ContactGroup[];
  state: StoredSync;
  onProgress?: (done: number, total: number) => void;
}): Promise<{ state: StoredSync; summary: SyncSummary }> {
  const selected = new Set(input.groups);
  const drafts = input.rows.filter((row) => selected.has(row.contactGroup)).map((row) => toDeviceDraft(row));
  const index = await readDeviceIndex();
  const plan = planSync({
    drafts,
    mapping: input.state.mapping,
    existingDeviceIds: index.ids,
    taggedDeviceIds: index.tagged,
  });
  const group = await openPortalGroup();
  const mapping = { ...input.state.mapping };
  let added = 0;
  let updated = 0;
  let failed = 0;
  let missingPhone = 0;
  let missingEmail = 0;
  const total = plan.add.length + plan.update.length;
  let done = 0;

  const remember = (contactKey: string, deviceId: string, draftMissingPhone: boolean, draftMissingEmail: boolean) => {
    mapping[contactKey] = deviceId;
    if (draftMissingPhone) missingPhone += 1;
    if (draftMissingEmail) missingEmail += 1;
  };

  for (const draft of plan.add) {
    try {
      const deviceId = await createDeviceContact(draft, group);
      remember(draft.contactKey, deviceId, draft.missingPhone, draft.missingEmail);
      added += 1;
    } catch {
      failed += 1;
    }
    done += 1;
    input.onProgress?.(done, total);
  }

  for (const item of plan.update) {
    try {
      await updateDeviceContact(item.deviceContactId, item.draft, group);
      remember(item.draft.contactKey, item.deviceContactId, item.draft.missingPhone, item.draft.missingEmail);
      updated += 1;
    } catch {
      try {
        const deviceId = await createDeviceContact(item.draft, group);
        remember(item.draft.contactKey, deviceId, item.draft.missingPhone, item.draft.missingEmail);
        added += 1;
      } catch {
        failed += 1;
      }
    }
    done += 1;
    input.onProgress?.(done, total);
  }

  const finished = total === 0 || added + updated > 0;
  return {
    state: {
      mapping,
      lastSyncedAt: finished ? new Date().toISOString() : input.state.lastSyncedAt,
    },
    summary: {
      added,
      updated,
      skipped: plan.skipped.length,
      failed,
      missingPhone,
      missingEmail,
    },
  };
}

export async function runRemove(state: StoredSync): Promise<{ state: StoredSync; removed: number; failed: number }> {
  const index = await readDeviceIndex();
  const ids = deviceIdsToRemove(state.mapping, index.tagged);
  const removedIds = new Set<string>();
  let failed = 0;
  for (const id of ids) {
    try {
      await deleteDeviceContact(id);
      removedIds.add(id);
    } catch {
      failed += 1;
    }
  }
  const mapping: Record<string, string> = {};
  if (failed > 0) {
    for (const [key, id] of Object.entries(state.mapping)) {
      if (!removedIds.has(id)) mapping[key] = id;
    }
  }
  return { state: { mapping, lastSyncedAt: state.lastSyncedAt }, removed: removedIds.size, failed };
}
