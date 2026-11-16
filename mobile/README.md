# GTA Portal companion

A phone app for people who already use the [GTA Portal](https://gta-portal.vercel.app). It signs in with the same Supabase account and copies contacts the account can already see into the phone's address book.

The copy is one way. The app reads a view and writes only to the phone. It never updates learners, employers, tutors, or staff in the Portal.

## What it syncs

The app reads `public.portal_address_book`. That view is `security_invoker`, so the Portal's row security still decides which rows come back.

| Group | Source | What lands on the phone |
| --- | --- | --- |
| Learners | `apprentices`, plus the current row in `apprentice_employments` and `employers` | Name, employer, programme. There is no phone column on apprentices, and emails are often empty. Those contacts are saved with the name only. |
| Employers | `employer_managers`, with `employers` and `employer_sites` | Name, phone, email, company, site |
| Tutors | `profiles` where `base_role` is Tutor | Name, email, job title. Profiles have no phone column. |
| Staff | Other active or invited `profiles` | Name, email, job title |

Test apprentices are left out. Archived and disabled profiles are left out. A tutor still only receives the apprentices `tutor_can_see` already allows.

Running sync again updates the same phone contacts. The app keeps a local map from the Portal id (`learner:GTA-000042`, `employer:<uuid>`, `profile:<uuid>`) to the phone contact id. It also tags the contact: a GTA Portal group on iPhone, a nickname where the phone allows it, and a note when the phone allows notes. iOS contact notes need an entitlement that Expo Go does not have, so Expo Go relies on the local map and the nickname.

UK numbers are stored as E.164 (`01302 893277` becomes `+441302893277`) when the number is a normal UK length. Anything else is kept only when it still looks like a phone number.

## Run it in Expo Go

Use a recent Expo Go from the App Store or Play Store. SDK 58 needs a matching Expo Go.

```bash
cd mobile
npm install
cp .env.example .env
```

Fill `.env` with the Portal's public Supabase values:

```bash
EXPO_PUBLIC_SUPABASE_URL=        # same as NEXT_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY=   # same as NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Do not paste `SUPABASE_SERVICE_ROLE_KEY`. The app refuses a key whose JWT role is `service_role`.

```bash
npx expo start
```

Scan the QR code with the iPhone camera or the Android Expo Go app. Sign in with a Portal email and password, allow contacts, choose the groups, and tap Sync.

The address book returns nothing useful until the migration `supabase/migrations/20261116060147_portal_address_book.sql` has been applied to the Supabase project. Apply it with the project's usual migration process. This app does not apply it.

If the Portal project requires hCaptcha on password sign-in, the phone cannot complete that check. Password sign-in has to be allowed without captcha for this app.

## Build with EAS

Expo Go is enough to try the sync. A store or internal build uses [EAS](https://docs.expo.dev/build/setup/).

```bash
cd mobile
npm install
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile preview
npx eas-cli@latest build --platform ios --profile preview
```

`preview` produces an internal Android APK and an internal iOS build. `production` is for the stores. The first build asks you to create an Expo project for the slug `gta-portal`. Bundle ids are `uk.co.doncastergta.portal` on both platforms; change them in `app.json` before a store submission if Doncaster GTA uses different ids.

Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` as EAS environment variables for the build profile. EAS does not read your local `.env` unless you opt into that.

iOS notes in a real build also need Apple's contact-notes entitlement. `ios.accessesContactNotes` is already set. Expo Go still will not write notes.

## Tests

From the repo root, the Portal test run includes the sync tests:

```bash
npm test
```

Or only the companion tests:

```bash
npx vitest run mobile/src
```

Type-check the app from `mobile/`:

```bash
npm run typecheck
```
