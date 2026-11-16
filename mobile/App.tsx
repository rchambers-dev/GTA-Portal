import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, Linking, StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { readSupabaseConfig } from "./src/config";
import {
  askContactsPermission,
  readContactsPermission,
  type ContactsAccess,
} from "./src/device-contacts";
import { explainSignInError } from "./src/errors";
import { fetchAddressBook } from "./src/fetch-address-book";
import { SignInScreen } from "./src/screens/SignInScreen";
import { SyncScreen } from "./src/screens/SyncScreen";
import { loadSyncState, saveSyncState, type StoredSync } from "./src/storage";
import { createPortalClient } from "./src/supabase";
import { runRemove, runSync } from "./src/sync-runner";
import { colors } from "./src/theme";
import type { SyncSummary } from "./src/plan-sync";
import type { AddressBookRow, ContactGroup } from "./src/types";

const emptySync: StoredSync = { mapping: {}, lastSyncedAt: null };

export default function App() {
  const config = useMemo(() => readSupabaseConfig(), []);
  const client = useMemo(() => (config ? createPortalClient(config) : null), [config]);
  const [ready, setReady] = useState(!client);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [rows, setRows] = useState<AddressBookRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [access, setAccess] = useState<ContactsAccess | "unknown">("unknown");
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [stored, setStored] = useState<StoredSync>(emptySync);
  const [storedUserId, setStoredUserId] = useState<string | null>(null);
  const storedReady = storedUserId === userId && userId !== null;
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [summary, setSummary] = useState<SyncSummary | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;
    let active = true;
    client.auth.getSession().then(({ data }) => {
      if (!active) return;
      setEmail(data.session?.user.email ?? null);
      setUserId(data.session?.user.id ?? null);
      setReady(true);
    });
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
      setUserId(session?.user.id ?? null);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client]);

  useEffect(() => {
    let active = true;
    readContactsPermission()
      .then((permission) => {
        if (!active) return;
        setAccess(permission.access);
        setCanAskAgain(permission.canAskAgain);
      })
      .catch(() => {
        if (active) setAccess("denied");
      });
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!client || !userId) return;
    let active = true;
    setRows(null);
    setLoadError(null);
    setLoading(true);
    fetchAddressBook(client)
      .then((next) => {
        if (!active) return;
        setRows(next);
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setRows(null);
        setLoadError(error instanceof Error ? error.message : "Contacts could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [client, userId, reloadToken]);

  useEffect(() => {
    if (!userId || storedUserId === userId) return;
    let active = true;
    setSummary(null);
    setNotice(null);
    loadSyncState(userId).then((state) => {
      if (!active) return;
      setStored(state);
      setStoredUserId(userId);
    });
    return () => {
      active = false;
    };
  }, [storedUserId, userId]);

  const requestAccess = useCallback(async () => {
    const permission = await askContactsPermission();
    setAccess(permission.access);
    setCanAskAgain(permission.canAskAgain);
  }, []);

  const sync = useCallback(
    async (groups: ContactGroup[]) => {
      if (!userId || !rows || !storedReady) return;
      setBusy(true);
      setNotice(null);
      setProgress(null);
      try {
        const result = await runSync({
          rows,
          groups,
          state: stored,
          onProgress: (done, total) => setProgress(total === 0 ? null : `Saving ${done} of ${total}`),
        });
        setStored(result.state);
        await saveSyncState(userId, result.state);
        setSummary(result.summary);
        setProgress(null);
      } catch (error: unknown) {
        setNotice(error instanceof Error ? error.message : "Sync did not finish.");
      } finally {
        setBusy(false);
      }
    },
    [rows, stored, storedReady, userId],
  );

  const remove = useCallback(async () => {
    if (!userId) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await runRemove(stored);
      setStored(result.state);
      await saveSyncState(userId, result.state);
      setSummary(null);
      const problem = result.failed > 0 ? ` ${result.failed} could not be removed.` : "";
      setNotice(`Removed ${result.removed} ${result.removed === 1 ? "contact" : "contacts"}.${problem}`);
    } catch (error: unknown) {
      setNotice(error instanceof Error ? error.message : "Contacts could not be removed.");
    } finally {
      setBusy(false);
    }
  }, [stored, userId]);

  let body: ReactNode;
  if (!ready) {
    body = (
      <View style={styles.splash}>
        <ActivityIndicator color={colors.white} />
      </View>
    );
  } else if (!config || !client) {
    body = <SignInScreen mode="missing-config" submitting={false} error={null} onSubmit={() => undefined} />;
  } else if (!userId) {
    body = (
      <SignInScreen
        mode="form"
        submitting={submitting}
        error={signInError}
        onSubmit={(nextEmail, password) => {
          setSubmitting(true);
          setSignInError(null);
          client.auth
            .signInWithPassword({ email: nextEmail.trim().toLowerCase(), password })
            .then(({ error }) => {
              if (error) setSignInError(explainSignInError(error.message));
            })
            .catch(() => setSignInError("Unable to sign in."))
            .finally(() => setSubmitting(false));
        }}
      />
    );
  } else {
    body = (
      <SyncScreen
        email={email ?? "Signed in"}
        rows={rows}
        loadError={loadError}
        loading={loading || !storedReady}
        access={access}
        canAskAgain={canAskAgain}
        busy={busy}
        progress={progress}
        lastSyncedAt={stored.lastSyncedAt}
        summary={summary}
        notice={notice}
        onSignOut={() => {
          setSummary(null);
          setNotice(null);
          void client.auth.signOut();
        }}
        onReload={() => setReloadToken((value) => value + 1)}
        onRequestAccess={() => void requestAccess()}
        onOpenSettings={() => void Linking.openSettings()}
        onSync={(groups) => void sync(groups)}
        onRemove={() => void remove()}
      />
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={userId ? "light-content" : "light-content"} />
      {body}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
});
