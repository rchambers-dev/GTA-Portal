# Supabase Auth email templates — GTA Portal

Copy each template into Supabase → **Authentication → Emails** (or **Email Templates**).  
Keep the `{{ .… }}` variables exactly as written.

Update this file as we brand the other templates.

**Progress**

- [x] Confirm sign up
- [x] Magic link or OTP
- [ ] Invite user
- [ ] Change email address
- [x] Reset password
- [x] Reauthentication

---

## Confirm sign up

**Supabase screen:** Emails → Confirm sign up

### Subject

```text
Confirm your GTA Portal email address
```

### Body (Source)

```html
<h2>Confirm your email address</h2>

<p>Hello,</p>

<p>
  An account has been created for you on <strong>GTA Portal</strong>
  — the apprenticeship training system used by Group Training Association.
</p>

<p>
  Please confirm this email address to finish setting up your account and
  sign in.
</p>

<p>
  <a href="{{ .ConfirmationURL }}">Confirm email address</a>
</p>

<p>
  If you did not expect this email, you can ignore it. If you are unsure,
  contact your tutor or GTA support.
</p>

<p>
  Thanks,<br />
  GTA Portal
</p>
```

### Variables used

- `{{ .ConfirmationURL }}` — required confirmation link

---

## Magic link or OTP

**Supabase screen:** Emails → Magic link or OTP

### Subject

```text
Your GTA Portal sign-in link
```

### Body (Source)

```html
<h2>Your GTA Portal sign-in link</h2>

<p>Hello,</p>

<p>
  Use the link below to sign in to <strong>GTA Portal</strong>
  (Group Training Association).
</p>

<p>
  This link expires shortly and can only be used once.
</p>

<p>
  <a href="{{ .ConfirmationURL }}">Sign in to GTA Portal</a>
</p>

<p>
  If you did not request this email, you can ignore it. If you are unsure,
  contact your tutor or GTA support.
</p>

<p>
  Thanks,<br />
  GTA Portal
</p>
```

### Variables used

- `{{ .ConfirmationURL }}` — required sign-in link

---

## Reset password

**Supabase screen:** Emails → Reset password

### Subject

```text
Reset your GTA Portal password
```

### Body (Source)

```html
<h2>Reset your GTA Portal password</h2>

<p>Hello,</p>

<p>
  We received a request to reset the password for your
  <strong>GTA Portal</strong> account (Group Training Association).
</p>

<p>
  Follow the link below to choose a new password. This link expires shortly
  and can only be used once.
</p>

<p>
  <a href="{{ .ConfirmationURL }}">Reset password</a>
</p>

<p>
  If you did not request this, you can safely ignore this email. Your
  password will stay the same.
</p>

<p>
  If you are unsure about this message, contact your tutor or GTA support.
</p>

<p>
  Thanks,<br />
  GTA Portal
</p>
```

### Variables used

- `{{ .ConfirmationURL }}` — required password-reset link

---

## Reauthentication

**Supabase screen:** Emails → Reauthentication

### Subject

```text
{{ .Token }} is your GTA Portal verification code
```

### Body (Source)

```html
<h2>Your GTA Portal verification code</h2>

<p>Hello,</p>

<p>
  Use the code below to verify your identity on
  <strong>GTA Portal</strong> (Group Training Association) before continuing
  with a sensitive change.
</p>

<p>
  <strong style="font-size: 1.4em; letter-spacing: 0.08em;">{{ .Token }}</strong>
</p>

<p>
  This code expires shortly. Do not share it with anyone.
</p>

<p>
  If you did not request this, contact your tutor or GTA support straight away.
</p>

<p>
  Thanks,<br />
  GTA Portal
</p>
```

### Variables used

- `{{ .Token }}` — required one-time verification code (keep in subject and body)

---

## Change log

| Date | Change |
|------|--------|
| 2026-07-27 | Added Confirm sign up template |
| 2026-07-27 | Corrected org name to Group Training Association |
| 2026-07-27 | Added Magic link or OTP template |
| 2026-07-27 | Added Reset password template |
| 2026-07-27 | Added Reauthentication template |
