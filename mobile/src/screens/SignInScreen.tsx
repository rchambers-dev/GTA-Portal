import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, space } from "../theme";

type Props = {
  mode: "missing-config" | "form";
  submitting: boolean;
  error: string | null;
  onSubmit: (email: string, password: string) => void;
};

export function SignInScreen({ mode, submitting, error, onSubmit }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting;

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.body}>
          <Image source={require("../../assets/gta-logo.jpg")} style={styles.logo} accessibilityIgnoresInvertColors />
          <Text style={styles.meta}>Doncaster & Sheffield</Text>
          <Text accessibilityRole="header" style={styles.title}>
            GTA Portal
          </Text>
          <Text style={styles.lead}>
            Copies contacts you can already see onto this phone. Nothing is written back to the Portal.
          </Text>

          {mode === "missing-config" ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Add the Portal keys</Text>
              <Text style={styles.cardBody}>
                Copy NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY into mobile/.env as
                EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart Expo.
              </Text>
            </View>
          ) : (
            <View style={styles.form}>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                textContentType="username"
                placeholder="name@doncastergta.co.uk"
                placeholderTextColor={colors.faint}
                style={styles.input}
                accessibilityLabel="Email"
                editable={!submitting}
              />
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
                textContentType="password"
                placeholder="Password"
                placeholderTextColor={colors.faint}
                style={styles.input}
                accessibilityLabel="Password"
                editable={!submitting}
                onSubmitEditing={() => {
                  if (canSubmit) onSubmit(email, password);
                }}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !canSubmit }}
                disabled={!canSubmit}
                onPress={() => onSubmit(email, password)}
                style={({ pressed }) => [styles.button, !canSubmit && styles.buttonDisabled, pressed && canSubmit && styles.buttonPressed]}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.buttonText}>Sign in</Text>
                )}
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  body: { flex: 1, justifyContent: "center", paddingHorizontal: space.xl, paddingVertical: space.xxl },
  logo: { width: 64, height: 64, borderRadius: 14, marginBottom: space.lg },
  meta: { color: "#d8dbe8", fontSize: 13, letterSpacing: 0.4, textTransform: "uppercase" },
  title: { color: colors.white, fontSize: 36, fontWeight: "700", letterSpacing: -0.6, marginTop: space.xs },
  lead: { color: "#d8dbe8", fontSize: 16, lineHeight: 23, marginTop: space.md, marginBottom: space.xl },
  form: { gap: space.md },
  input: {
    backgroundColor: colors.white,
    color: colors.navy,
    borderRadius: 12,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
    fontSize: 16,
  },
  error: { color: "#ffb4b6", fontSize: 15, lineHeight: 21 },
  button: {
    backgroundColor: colors.red,
    borderRadius: 12,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPressed: { backgroundColor: colors.redPressed },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: colors.white, fontSize: 17, fontWeight: "700" },
  card: { backgroundColor: colors.navy, borderRadius: 16, padding: space.lg },
  cardTitle: { color: colors.white, fontSize: 18, fontWeight: "700", marginBottom: space.sm },
  cardBody: { color: "#d8dbe8", fontSize: 15, lineHeight: 22 },
});
