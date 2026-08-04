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
      <div className={styles.wash} aria-hidden />
      <p className={styles.watermark} aria-hidden>
        GTA
      </p>

      <header className={styles.topBar}>
        <a href={WEBSITE_URL} className={styles.siteLink}>
          ← Website
        </a>
        <span className={styles.bayTag}>Bay · Secure entry</span>
      </header>

      <div className={styles.frame}>
        <article className={styles.pass}>
          <div className={styles.passRail} aria-hidden />
          <div className={styles.passBody}>
            <div className={styles.passHead}>
              <Image
                src="/images/brand/gta-logo.png"
                alt=""
                width={56}
                height={56}
                className={styles.logo}
                priority
              />
              <div>
                <p className={styles.passMeta}>Doncaster &amp; Sheffield</p>
                <h1 className={styles.passTitle}>GTA Portal</h1>
              </div>
            </div>

            <p className={styles.passLead}>
              Sign in to open your workspace. Staff accounts use{" "}
              <strong>@doncastergta.co.uk</strong>.
            </p>

            <LoginForm
              defaultEmail="reisschambers@doncastergta.co.uk"
              next={next}
            />
          </div>
        </article>
      </div>
    </main>
  );
}
