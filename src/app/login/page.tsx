import Image from "next/image";
import { redirect } from "next/navigation";
import { getStandalonePorts } from "@/adapters/standalone";
import { getDefaultWorkspaceRoute } from "@/lib/permissions/workspace";
import { LoginForm } from "./LoginForm";
import styles from "./login.module.css";

const WEBSITE_URL =
  process.env.NEXT_PUBLIC_WEBSITE_URL?.replace(/\/$/, "") ||
  "https://gta-website-two.vercel.app";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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
      <header className={styles.header}>
        <a href={WEBSITE_URL} className={styles.brand} aria-label="GTA website">
          <Image
            src="/images/brand/gta-logo.png"
            alt=""
            width={44}
            height={44}
            className={styles.brandMark}
            priority
          />
          <span>GTA Portal</span>
        </a>
        <a href={WEBSITE_URL} className={styles.back}>
          Back to website
        </a>
      </header>

      <div className={styles.main}>
        <section className={styles.card}>
          <p className={styles.eyebrow}>Secure access</p>
          <h1 className={styles.title}>Sign in</h1>
          <p className={styles.copy}>
            Use your GTA account (
            <strong>@doncastergta.co.uk</strong> for staff). Your role opens the
            right workspace automatically.
          </p>
          <LoginForm
            defaultEmail="reisschambers@doncastergta.co.uk"
            next={next}
          />
          <p className={styles.note}>
            Public site and portal are one platform — sign in here to continue
            your apprenticeship journey.
          </p>
        </section>
      </div>
    </main>
  );
}
