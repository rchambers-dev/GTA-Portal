# GTA Portal companion

A phone app for people who already use the [GTA Portal](https://gta-portal.vercel.app). It signs in with the same Supabase account and copies contacts the account can already see into the phone's address book.

The copy is one way. The app reads a view and writes only to the phone. It never updates learners, employers, tutors, or staff in the Portal.

## What it syncs

The app reads `public.portal_address_book`. That view is `security_invoker`, so the Portal's row security still decides which rows come back.

| Group | Source | What lands on the phone |
| --- | --- | --- |
| Learners | `apprentices`, plus the current row in `apprentice_employments` and `employers` | Name, phone, email, employer, and programme. Phone and email are optional until someone enters them on the learner page. |
| Employers | `employer_managers`, with `employers` and `employer_sites` | Name, phone, email, company, site |
| Tutors | `profiles` where `base_role` is Tutor | Name, email, and job title. Staff profiles store the login email, not a separate phone number. |
| Staff | Other active or invited `profiles` | Name, email, and job title |

Test apprentices are left out. Archived and disabled profiles are left out. A tutor still only receives the apprentices `tutor_can_see` already allows.

Running sync again updates the same phone contacts. The app keeps a local map from the Portal id (`learner:GTA-000042`, `employer:<uuid>`, `profile:<uuid>`) to the phone contact id. It also stores that id as a nickname, and as a note when the phone allows notes. iOS notes need an entitlement that Expo Go does not have, so Expo Go relies on the local map and the nickname.

UK numbers are stored as E.164 (`01302 893277` becomes `+441302893277`) when the number is a normal UK length. Anything else is kept only when it still looks like a phone number.

## Folders on the phone

Each synced choice is filed under its own name:

| Choice | Folder |
| --- | --- |
| Employers | GTA Employers |
| Learners | GTA Learners |
| Tutors and staff | GTA Staff |

Tutors are staff, so there is no GTA Tutors folder. A person who appears in both the tutor list and the staff list is saved once, in GTA Staff.

On an iPhone, the app looks up each folder in the default contacts account and creates it only when it is missing. A later sync reuses it. Someone left in an older GTA Tutors folder, or in the first version's GTA Portal folder, is moved into GTA Staff. Remove all synced contacts also deletes these folders, including a leftover GTA Tutors folder. Other folders, such as Family, are left alone. Deleting a folder does not delete people who were not added by this app.

On Android, Expo's contacts library cannot create or read contact groups. The app does not call those methods, so it does not crash. Each synced person is tagged instead: the department and the phone or email label are set to the folder name, for example GTA Learners. You can filter or search the address book by that label. Remove all deletes the people this app added. There is no Android folder to remove.

## Run it in Expo Go

Use a recent Expo Go from the App Store or Play Store. SDK 58 needs a matching Expo Go.

```bash
cd mobile
npm install
npx expo start
```

No env file is required. The app is wired to the public Portal Supabase project (`https://cjtgjxgghfiskqnuttzd.supabase.co`) and its publishable key. `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` override those defaults when set. Do not put `SUPABASE_SERVICE_ROLE_KEY` in the app. A JWT whose role is `service_role` is refused.

Scan the QR code with the iPhone camera or the Android Expo Go app. Sign in with a Portal email and password, allow contacts, choose the groups, and tap Sync.

Password sign-in does not ask for a captcha. The Portal's own hCaptcha check stays off unless `NEXT_PUBLIC_HCAPTCHA_ENABLED` is exactly `true`. Turning captcha on in Supabase Auth would block this app, because the phone cannot complete that check.

Learner phone numbers appear after `supabase/migrations/20261116062747_apprentice_contact_phone.sql` is applied. Until then, learner rows sync with whatever phone the address book already returns.

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

An EAS build uses the same public defaults. Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` on the build profile only when you want a different Supabase project.

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
