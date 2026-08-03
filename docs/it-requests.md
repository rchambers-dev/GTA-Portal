# IT company setup requests — GTA Portal

Living list of infrastructure items we need from IT so the portal can go live properly.  
We will add to this document as we discover more requirements.

**Project:** GTA Portal (Group Training Association — apprenticeship / training centre)  
**Hosting:** Vercel — `gta-portal` + `gta-website` (leave Wix; see §3)  
**Database / Auth:** Supabase — `GTA-Portal` + `GTA-Website` (separate DBs on purpose)  
**Owner (GTA):** Reiss Chambers  

---

## How to use this list

| Status | Meaning |
|--------|---------|
| Pending | Not requested / not done |
| Requested | Asked of IT; waiting |
| Done | Confirmed working |
| Blocked | Waiting on a decision or another item |

Update the status column as things move. Newest items go at the bottom of each section (or add a new section).

---

## 1. Email / SMTP (auth messages) — **Pending**

### Why we need this

Supabase Auth sends validation emails to apprentices and staff (confirm email, password reset, etc.).  
Default Supabase email is rate-limited and not branded. For production we need **custom SMTP** so:

- Messages come from a GTA address (trusted / deliverable)
- We can raise email rate limits for enrolment and password-reset periods

### What we need created

A **send-only / shared mailbox** that people do **not** use as a normal day-to-day login, for example:

- Preferred: `noreply@<gta-domain>`  
- Acceptable: `portal@<gta-domain>`

Pupils still receive mail in **their own** inboxes. This address is only the **From** line (“sent by GTA Portal”).

Managed in **Microsoft 365 / Azure (Entra)** is fine and preferred if that is already how GTA email works.

### Please provide back to us

| Item | Example / notes |
|------|------------------|
| Sender email address | `noreply@…` |
| Sender display name | `GTA Portal` |
| SMTP host | e.g. `smtp.office365.com` |
| SMTP port | Usually `587` (STARTTLS) or `465` (SSL) |
| SMTP username | Often the full email address |
| SMTP password or app password | Secure handoff — not email in plain text if possible |
| SMTP AUTH enabled | Required for app sending |
| Confirmed: mailbox is send-only / shared | No one needs to “work” in this inbox |

### Alternative (also acceptable)

If IT prefers an app mail provider instead of a mailbox:

- **Resend**, **SendGrid**, or **Amazon SES**
- Domain DNS records to verify sending from `@<gta-domain>`
- API key or SMTP credentials for that service

### Where we will use it

Supabase Dashboard → **Project Settings → Authentication → SMTP**  
(Custom SMTP enabled, then rate limits increased.)

### Acceptance check

- [ ] Test “reset password” / “confirm email” arrives from the GTA From address  
- [ ] Not junked for a test GTA / pupil address  
- [ ] Supabase custom SMTP toggle On with all fields filled  

---

## 2. Microsoft / Azure staff sign-in (SSO) — **Pending (later)**

Not required for first Auth go-live (email + password is fine first).  
When ready, we will ask IT for an **Entra ID (Azure AD) app registration** so staff can sign in with their work Microsoft account.

### Likely to request later

- App registration name (e.g. GTA Portal)  
- Application (client) ID  
- Client secret (or certificate)  
- Redirect URI for Supabase Auth Azure callback  
- Which groups/users are allowed (staff only vs apprentices too)  

*Details will be filled in when we start Azure SSO.*

---

## 3. Domain / DNS — leave Wix, host on Vercel — **Pending**

### Goal

Drop **Wix** as the public hoster. Keep one GTA brand domain, with separate apps:

| App | Vercel project | Supabase project | Purpose |
|-----|----------------|------------------|---------|
| Public website | `gta-website` | `GTA-Website` | Exhibition cars, trade stands, events, announcements |
| Apprenticeship portal | `gta-portal` | `GTA-Portal` | Logins, apprentices, tasks, OTJ, evidence |

Same organisation domain; **not** the same hostname for both apps.

### Recommended hostnames (subdomains)

A **subdomain** is the label in front of the main domain (e.g. `portal` in `portal.gta….co.uk`).

| Hostname | Points to |
|----------|-----------|
| `www.<gta-domain>` (and/or apex `<gta-domain>`) | Vercel project **gta-website** |
| `portal.<gta-domain>` | Vercel project **gta-portal** |

Website top-right “Portal” button → link to `https://portal.<gta-domain>`.

### Why not one path like `/portal` on the same site?

Possible, but messier for Auth redirects, cookies, and deploys. **Subdomain is preferred.**

### What we need from IT / domain owner

Currently domain DNS may sit with **Wix**. We want to move off Wix hosting entirely.

Please either:

1. **Move DNS** to a proper DNS host (registrar, Cloudflare, or Vercel DNS), **or**  
2. Keep nameservers where they are but ensure we can add records Wix cannot block  

Then add records (exact targets come from Vercel when domains are added):

| Type | Name | Target (typical) |
|------|------|------------------|
| CNAME or A/ALIAS | `www` / `@` | Vercel website project (per Vercel Domains UI) |
| CNAME | `portal` | Vercel portal project (often `cname.vercel-dns.com` — confirm in Vercel) |

Also needed for SMTP (Section 1), if using Resend/SendGrid:

- [ ] DNS records to verify sending from `@<gta-domain>`

### After DNS is live — GTA / Reiss to do

- [ ] Vercel → `gta-website` → Domains → add `www` / apex  
- [ ] Vercel → `gta-portal` → Domains → add `portal.<gta-domain>`  
- [ ] Supabase **GTA-Portal** → Auth URL config: Site URL + Redirect URLs = portal hostname  
- [ ] Website nav “Portal” button → `https://portal.<gta-domain>`  
- [ ] Cancel / stop Wix site hosting once cutover is confirmed  

### Acceptance check

- [ ] `https://www.<gta-domain>` (or apex) loads the Vercel website  
- [ ] `https://portal.<gta-domain>` loads the Vercel portal  
- [ ] Auth emails / login redirects use the portal hostname (not `localhost`, not only `*.vercel.app`)  
- [ ] Wix no longer required for public pages  

### Temporary (until cutover)

- Website: `https://gta-website-two.vercel.app`  
- Portal: `https://gta-portal.vercel.app`  
Fine for building; not the long-term pupil-facing URLs.

---

## 4. Security / accounts (GTA side + IT) — **In progress**

| Item | Status | Notes |
|------|--------|-------|
| Second Supabase org owner | Confirm | Avoid lockout |
| MFA on Supabase org accounts | Confirm | Enforce if possible |
| Dedicated `noreply` / portal send address | Pending | Section 1 |
| MFA / Conditional Access for staff Microsoft accounts | IT policy | Separate from Supabase; good practice |

---

## 5. Already done (no IT action)

| Item | Notes |
|------|--------|
| Vercel project + Production env vars | Keys only: AI_API_KEY, GIPHY, Supabase URL/keys, hCaptcha. AI provider/model/cap use code defaults. |
| Supabase project created | `https://cjtgjxgghfiskqnuttzd.supabase.co` |
| Supabase publishable + secret API keys | Named `gta_portal` / `gta_portal_server` |
| Auth: Email provider enabled | Azure SSO left off for now |
| Auth sessions (prod baseline) | Single session on; time-box 168h; inactivity 8h |
| Access token expiry | 3600 seconds |
| Refresh token reuse detection | On; 10s reuse interval |
| Leaked password protection | On (Have I Been Pwned) |
| Password policy | Min 8; upper + lower + digits + symbols |
| Secure password / email change | On |
| hCaptcha (free) | Enabled in Supabase Attack Protection; keys on Vercel |
| Auth email templates (branded) | Confirm, magic link, reset password, reauth |

---

## 6. Portal / frontend wiring still needed (dev — not IT)

These are configured in Supabase/Vercel but **not connected in the app UI yet**. Do when building real login.

| Item | Status | Notes |
|------|--------|--------|
| Wire hCaptcha into login / sign-up / reset forms | Pending | Use `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` in the browser; Supabase already has the secret for Auth API verification |
| Supabase JS clients (`@supabase/ssr`) | Pending | Install + browser/server clients when replacing demo auth |
| Final Site URL + Redirect URLs | Waiting | Set to `https://portal.<gta-domain>` after Section 3 DNS cutover |
| Custom SMTP (`noreply@…`) | Pending IT | Section 1 — required before raising email rate limits |
| Leave Wix / attach custom domains | Pending | Section 3 |

---

## Message draft to IT (copy/paste)

> Hi,  
>  
> We’re setting up production auth for the GTA Portal (hosted on Vercel, auth via Supabase).  
>  
> Please create a send-only / shared mailbox such as `noreply@<domain>` (or `portal@<domain>`) that staff do not use as a normal inbox. We need SMTP credentials (host, port, username, password, SMTP AUTH enabled) so the portal can send account confirmation and password-reset emails **from** that address **to** apprentices’ and staff’s own email addresses.  
>  
> Microsoft 365 / Azure is preferred if that matches how GTA email is run. Resend/SendGrid with domain verification is also fine.  
>  
> Please send the SMTP details via a secure channel. Happy to jump on a call if useful.  
>  
> Thanks

---

## Change log

| Date | Change |
|------|--------|
| 2026-07-27 | Created list; added SMTP / noreply mailbox request; noted SSO and DNS as later items; recorded Auth settings already configured in Supabase |
| 2026-07-27 | Org name noted as Group Training Association; added hCaptcha + frontend wiring backlog; expanded “already done” Auth hardening |
| 2026-07-27 | Expanded §3: leave Wix, www + portal subdomains on Vercel, separate website/portal Supabase projects |
