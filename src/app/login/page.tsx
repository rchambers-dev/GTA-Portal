import { redirect } from "next/navigation";
import { getStandalonePorts } from "@/adapters/standalone";
import { isDemoModeEnabled } from "@/lib/env/portal";
import { getDefaultWorkspaceRoute } from "@/lib/permissions/workspace";
import { LoginForm } from "./LoginForm";
import styles from "./login.module.css";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (isDemoModeEnabled()) {
    redirect("/");
  }

  const ports = getStandalonePorts();
  const session = await ports.auth.getEffectiveSession();
  if (session) {
    redirect(getDefaultWorkspaceRoute(session.account.workspace, session));
  }

  const params = await searchParams;
  const nextParam = Array.isArray(params.next) ? params.next[0] : params.next;
  const next =
    typeof nextParam === "string" && nextParam.startsWith("/") ? nextParam : "/";

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>GTA Portal</p>
        <h1 className={styles.title}>Sign in</h1>
        <p className={styles.copy}>
          Sign in with your GTA staff account (
          <strong>@doncastergta.co.uk</strong>).
        </p>
        <LoginForm
          defaultEmail="reisschambers@doncastergta.co.uk"
          next={next}
        />
      </section>
    </main>
  );
}
