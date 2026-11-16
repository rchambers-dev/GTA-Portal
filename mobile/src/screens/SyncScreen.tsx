import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { groupPreview, summariseGroups } from "../map-contact";
import { formatSyncedAt, type SyncSummary } from "../plan-sync";
import { colors, space } from "../theme";
import { CONTACT_GROUPS, GROUP_COPY, type AddressBookRow, type ContactGroup } from "../types";
import type { ContactsAccess } from "../device-contacts";

type Props = {
  email: string;
  rows: AddressBookRow[] | null;
  loadError: string | null;
  loading: boolean;
  access: ContactsAccess | "unknown";
  canAskAgain: boolean;
  busy: boolean;
  progress: string | null;
  lastSyncedAt: string | null;
  summary: SyncSummary | null;
  notice: string | null;
  onSignOut: () => void;
  onReload: () => void;
  onRequestAccess: () => void;
  onOpenSettings: () => void;
  onSync: (groups: ContactGroup[]) => void;
  onRemove: () => void;
};

export function SyncScreen(props: Props) {
  const [selected, setSelected] = useState<Record<ContactGroup, boolean>>({
    learner: true,
    employer: true,
    tutor: true,
    staff: true,
  });
  const counts = summariseGroups(props.rows ?? []);
  const chosen = CONTACT_GROUPS.filter((group) => selected[group]);
  const chosenCount = (props.rows ?? []).filter((row) => selected[row.contactGroup]).length;
  const canSync = props.access !== "denied" && props.access !== "unknown" && !props.busy && !props.loading && props.rows !== null && chosen.length > 0;

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={["top"]} style={styles.headerWrap}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text accessibilityRole="header" style={styles.brand}>
              GTA Portal
            </Text>
            <Text style={styles.email} numberOfLines={1}>
              {props.email}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            disabled={props.busy}
            onPress={props.onSignOut}
            style={styles.signOut}
          >
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={props.loading} onRefresh={props.onReload} tintColor={colors.red} />}
      >
        <Text style={styles.intro}>
          Choose who to copy onto this phone. On iPhone, each choice gets its own contacts folder. Running sync again updates the same people.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Contacts access</Text>
          <Text style={styles.cardBody}>{accessCopy(props.access)}</Text>
          {props.access === "denied" ? (
            <Pressable
              accessibilityRole="button"
              onPress={props.canAskAgain ? props.onRequestAccess : props.onOpenSettings}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>{props.canAskAgain ? "Allow contacts" : "Open settings"}</Text>
            </Pressable>
          ) : null}
          {props.access === "limited" ? (
            <Pressable accessibilityRole="button" onPress={props.onOpenSettings} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Allow full access</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.card}>
          {CONTACT_GROUPS.map((group) => {
            const on = selected[group];
            return (
              <Pressable
                key={group}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${GROUP_COPY[group].title}. ${groupPreview(counts[group])}`}
                onPress={() => setSelected((current) => ({ ...current, [group]: !current[group] }))}
                style={styles.groupRow}
              >
                <View style={[styles.box, on && styles.boxOn]}>{on ? <Text style={styles.tick}>✓</Text> : null}</View>
                <View style={styles.groupCopy}>
                  <Text style={styles.groupTitle}>{GROUP_COPY[group].title}</Text>
                  <Text style={styles.groupHint}>
                    {props.rows ? groupPreview(counts[group]) : props.loadError ? "Could not count" : "Counting…"}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {props.loadError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{props.loadError}</Text>
            <Pressable accessibilityRole="button" onPress={props.onReload} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSync }}
          disabled={!canSync}
          onPress={() => props.onSync(chosen)}
          style={({ pressed }) => [styles.primary, !canSync && styles.disabled, pressed && canSync && styles.primaryPressed]}
        >
          {props.busy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryText}>
              {props.rows ? `Sync ${chosenCount} ${chosenCount === 1 ? "contact" : "contacts"}` : "Sync now"}
            </Text>
          )}
        </Pressable>
        {props.progress ? <Text style={styles.progress}>{props.progress}</Text> : null}

        <Text style={styles.synced}>
          {props.lastSyncedAt ? `Last synced ${formatSyncedAt(props.lastSyncedAt)}` : "Not synced yet"}
        </Text>
        {props.summary ? <Summary summary={props.summary} /> : null}
        {props.notice ? <Text style={styles.notice}>{props.notice}</Text> : null}

        <Pressable
          accessibilityRole="button"
          disabled={props.busy}
          onPress={() => {
            if (props.access === "unknown") return;
            if (props.access === "denied") {
              if (props.canAskAgain) props.onRequestAccess();
              else props.onOpenSettings();
              return;
            }
            confirmRemove(props.onRemove);
          }}
          style={styles.remove}
        >
          <Text style={styles.removeText}>Remove contacts and folders added by this app</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Summary({ summary }: { summary: SyncSummary }) {
  return (
    <View style={styles.summary}>
      <SummaryLine label="Added" value={summary.added} />
      <SummaryLine label="Updated" value={summary.updated} />
      <SummaryLine label="Skipped" value={summary.skipped} />
      {summary.failed > 0 ? <SummaryLine label="Not saved" value={summary.failed} /> : null}
      {summary.missingPhone > 0 ? (
        <Text style={styles.summaryNote}>{summary.missingPhone} saved with no phone number</Text>
      ) : null}
      {summary.missingEmail > 0 ? (
        <Text style={styles.summaryNote}>{summary.missingEmail} saved with no email address</Text>
      ) : null}
    </View>
  );
}

function SummaryLine({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.summaryLine}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function confirmRemove(onRemove: () => void) {
  Alert.alert(
    "Remove Portal contacts?",
    "This deletes contacts this app added on this phone, and removes the GTA folders on iPhone. Portal records stay as they are.",
    [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: onRemove },
    ],
  );
}

function accessCopy(access: Props["access"]): string {
  if (access === "granted") return "This phone can save Portal contacts.";
  if (access === "limited") {
    return "iOS is only sharing some contacts. Allow full access, otherwise a later sync can create duplicates.";
  }
  if (access === "denied") return "Contacts access is off. The Portal cannot copy anyone onto this phone until you allow it.";
  return "Checking contacts access…";
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  headerWrap: { backgroundColor: colors.navy },
  header: {
    minHeight: 64,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  headerText: { flex: 1 },
  brand: { color: colors.white, fontSize: 20, fontWeight: "700", letterSpacing: -0.3 },
  email: { color: "#d8dbe8", fontSize: 13, marginTop: 2 },
  signOut: { minHeight: 44, justifyContent: "center", paddingHorizontal: space.sm },
  signOutText: { color: colors.white, fontSize: 15, fontWeight: "600" },
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  intro: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  card: { backgroundColor: colors.white, borderRadius: 16, padding: space.lg, gap: space.md },
  cardTitle: { color: colors.navy, fontSize: 16, fontWeight: "700" },
  cardBody: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  groupRow: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 48 },
  box: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  boxOn: { backgroundColor: colors.red, borderColor: colors.red },
  tick: { color: colors.white, fontSize: 14, fontWeight: "700" },
  groupCopy: { flex: 1 },
  groupTitle: { color: colors.navy, fontSize: 16, fontWeight: "700" },
  groupHint: { color: colors.muted, fontSize: 13, marginTop: 2 },
  primary: {
    backgroundColor: colors.red,
    borderRadius: 12,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryPressed: { backgroundColor: colors.redPressed },
  primaryText: { color: colors.white, fontSize: 17, fontWeight: "700" },
  disabled: { opacity: 0.45 },
  secondaryButton: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: space.md,
    borderRadius: 10,
    backgroundColor: colors.page,
  },
  secondaryButtonText: { color: colors.navy, fontSize: 15, fontWeight: "700" },
  progress: { color: colors.muted, fontSize: 14 },
  synced: { color: colors.muted, fontSize: 14 },
  summary: { backgroundColor: colors.white, borderRadius: 16, padding: space.lg, gap: space.sm },
  summaryLine: { flexDirection: "row", justifyContent: "space-between" },
  summaryLabel: { color: colors.muted, fontSize: 15 },
  summaryValue: { color: colors.navy, fontSize: 15, fontWeight: "700" },
  summaryNote: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  notice: { color: colors.green, fontSize: 15, lineHeight: 21 },
  errorBox: { backgroundColor: colors.dangerSoft, borderRadius: 16, padding: space.lg, gap: space.sm },
  errorText: { color: colors.redPressed, fontSize: 15, lineHeight: 21 },
  remove: { minHeight: 44, justifyContent: "center", alignItems: "center" },
  removeText: { color: colors.red, fontSize: 15, fontWeight: "700" },
});
