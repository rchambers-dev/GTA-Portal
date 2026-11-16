import AsyncStorage from "@react-native-async-storage/async-storage";

export type StoredSync = {
  mapping: Record<string, string>;
  lastSyncedAt: string | null;
};

const empty = (): StoredSync => ({ mapping: {}, lastSyncedAt: null });

export async function loadSyncState(userId: string): Promise<StoredSync> {
  const raw = await AsyncStorage.getItem(storageKey(userId));
  if (!raw) return empty();
  try {
    const parsed = JSON.parse(raw) as Partial<StoredSync>;
    const mapping: Record<string, string> = {};
    if (parsed.mapping && typeof parsed.mapping === "object") {
      for (const [key, value] of Object.entries(parsed.mapping)) {
        if (typeof value === "string" && value.trim()) mapping[key] = value;
      }
    }
    return {
      mapping,
      lastSyncedAt: typeof parsed.lastSyncedAt === "string" ? parsed.lastSyncedAt : null,
    };
  } catch {
    return empty();
  }
}

export async function saveSyncState(userId: string, state: StoredSync): Promise<void> {
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(state));
}

function storageKey(userId: string): string {
  return `gta-portal-sync:${userId}`;
}
