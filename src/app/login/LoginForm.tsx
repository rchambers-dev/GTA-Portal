"use client";

import HCaptcha from "@hcaptcha/react-hcaptcha";
import { useActionState, useRef, useState } from "react";
import { loginAction, type LoginActionState } from "./actions";
import styles from "./login.module.css";

const initialState: LoginActionState = { error: null };
const siteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY?.trim() ?? "";

export function LoginForm({
  defaultEmail,
  next,
}: {
  defaultEmail: string;
  next: string;
}) {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);
  const [captchaToken, setCaptchaToken] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const captchaRef = useRef<HCaptcha>(null);

  return (
    <form
      className={styles.form}
      action={async (formData) => {
        await formAction(formData);
        captchaRef.current?.resetCaptcha();
        setCaptchaToken("");
      }}
    >
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="captchaToken" value={captchaToken} />

      <label className={styles.field}>
        <span>Email</span>
        <input
          className={styles.input}
          type="email"
          name="email"
          defaultValue={defaultEmail}
          autoComplete="username"
          required
          aria-invalid={state.error ? true : undefined}
        />
      </label>

      <label className={styles.field}>
        <span>Password</span>
        <div className={styles.passwordWrap}>
          <input
            className={`${styles.input} ${styles.inputPassword}`}
            type={showPassword ? "text" : "password"}
            name="password"
            autoComplete="current-password"
            required
            aria-invalid={state.error ? true : undefined}
          />
          <button
            type="button"
            className={styles.togglePassword}
            onClick={() => setShowPassword((prev) => !prev)}
            aria-pressed={showPassword}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </label>

      {siteKey ? (
        <div className={styles.captchaBlock}>
          <div className={styles.captchaHead}>
            <span className={styles.captchaLabel}>Security check</span>
            <span className={styles.captchaHint}>Confirm you’re human</span>
          </div>
          <div
            className={`${styles.captchaFrame}${captchaToken ? ` ${styles.captchaFrameOk}` : ""}`}
          >
            <HCaptcha
              ref={captchaRef}
              sitekey={siteKey}
              size="normal"
              theme="light"
              onVerify={(token) => setCaptchaToken(token)}
              onExpire={() => setCaptchaToken("")}
              onError={() => setCaptchaToken("")}
            />
          </div>
          {captchaToken ? (
            <p className={styles.captchaOk}>Verified — you can sign in</p>
          ) : null}
        </div>
      ) : (
        <p className={styles.error}>
          Missing NEXT_PUBLIC_HCAPTCHA_SITE_KEY — captcha cannot load.
        </p>
      )}

      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}

      <button
        className={styles.submit}
        type="submit"
        disabled={isPending || (Boolean(siteKey) && !captchaToken)}
      >
        {isPending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
