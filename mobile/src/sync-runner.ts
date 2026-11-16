import {
  createDeviceContact,
  deleteDeviceContact,
  deletePortalAddressBookGroups,
  openAddressBookGroups,
  readDeviceIndex,
  updateDeviceContact,
} from "./device-contacts";
import { collapseTutorAndStaff } from "./contact-groups";
import { deviceIdsToRemove, toDeviceDraft, type DraftResult } from "./map-contact";
import { syncProblemMessage } from "./ios-contacts";
import { planSync, type SyncSummary } from "./plan-sync";
import type { StoredSync } from "./storage";
import type { AddressBookRow, ContactGroup } from "./types";

export async function runSync(input: {
  rows: readonly AddressBookRow[];
  groups: readonly ContactGroup[];
  state: StoredSync;
  onProgress?: (done: number, total: number) => void;
}): Promise<{ state: StoredSync; summary: SyncSummary; notice: string | null }> {
  const selected = new Set(input.groups);
  const prepared = input.rows.filter((row) => selected.has(row.contactGroup)).map((row) => toDeviceDraft(row));
  const drafts = uniteTutorAndStaff(prepared);
  const index = await readDeviceIndex();
  const plan = planSync({
    drafts,
    mapping: input.state.mapping,
    existingDeviceIds: index.ids,
    taggedDeviceIds: index.tagged,
  });
  const groups = await openAddressBookGroups();
  const mapping = { ...input.state.mapping };
  let added = 0;
  let updated = 0;
  let failed = 0;
  let foldersFailed = groups.unavailable;
  let failureDetail: string | null = null;
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
      const saved = await createDeviceContact(draft, groups);
      if (saved.foldersFailed) foldersFailed = true;
      remember(draft.contactKey, saved.id, draft.missingPhone, draft.missingEmail);
      added += 1;
    } catch (error) {
      failed += 1;
      failureDetail ??= errorText(error);
    }
    done += 1;
    input.onProgress?.(done, total);
  }

  for (const item of plan.update) {
    try {
      const folderProblem = await updateDeviceContact(item.deviceContactId, item.draft, groups);
      if (folderProblem) foldersFailed = true;
      remember(item.draft.contactKey, item.deviceContactId, item.draft.missingPhone, item.draft.missingEmail);
      updated += 1;
    } catch (error) {
      try {
        const saved = await createDeviceContact(item.draft, groups);
        if (saved.foldersFailed) foldersFailed = true;
        remember(item.draft.contactKey, saved.id, item.draft.missingPhone, item.draft.missingEmail);
        added += 1;
      } catch (createError) {
        failed += 1;
        failureDetail ??= errorText(createError);
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
    notice: [syncProblemMessage({ failed, foldersUnavailable: foldersFailed }), failed > 0 ? failureDetail : null]
      .filter((part): part is string => Boolean(part))
      .join(" ") || null,
  };
}

function errorText(error: unknown): string {
  return error instanceof Error && error.message.trim() ? error.message.trim() : "A contact could not be saved.";
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
  await deletePortalAddressBookGroups();
  const mapping: Record<string, string> = {};
  if (failed > 0) {
    for (const [key, id] of Object.entries(state.mapping)) {
      if (!removedIds.has(id)) mapping[key] = id;
    }
  }
  return { state: { mapping, lastSyncedAt: state.lastSyncedAt }, removed: removedIds.size, failed };
}

function uniteTutorAndStaff(drafts: readonly DraftResult[]): DraftResult[] {
  const skipped = drafts.filter((item) => !item.ok);
  const people = collapseTutorAndStaff(drafts.flatMap((item) => (item.ok ? [item.draft] : [])));
  return [...people.map((draft) => ({ ok: true as const, draft })), ...skipped];
}
