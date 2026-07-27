# Auth frontend wiring backlog — GTA Portal

Config done in Supabase / Vercel. App code still needed.

## hCaptcha

**Done**
- Free hCaptcha site created
- Secret stored in Supabase → Authentication → Attack Protection
- Env on Vercel Production + `.env.local`:
  - `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` (browser)
  - `HCAPTCHA_SECRET_KEY` (server; optional if only Supabase verifies)

**Still to do (when building login)**
- [ ] Add the hCaptcha widget to sign-in / sign-up / password-reset forms
- [ ] Pass the captcha token through to Supabase Auth calls (`options.captchaToken` or equivalent)
- [ ] Confirm failed/missing captcha is rejected end-to-end on production

Until the widget is on the page, Captcha can block or confuse Auth if left enabled with no UI — test carefully when wiring login.

## Related waiting items

- [ ] Custom SMTP (`docs/it-requests.md` §1)
- [ ] Final Site URL / Redirect URLs when main GTA site portal button exists
- [ ] Supabase client libraries + replace demo session auth
