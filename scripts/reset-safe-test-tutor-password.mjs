/**
 * Password-only reset for the SAFE TEST tutor.
 * Does not change role, workspace, permissions, or real staff.
 *
 *   ALLOW_SAFE_TEST_TUTOR=1 node --env-file=.env.local scripts/reset-safe-test-tutor-password.mjs --confirm
 */
import fs from "fs";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const TUTOR_EMAIL = "test-autocare-tutor@example.invalid";
const TUTOR_ID = "d7f99919-c254-484a-9027-943480ad9a59";
const PASSWORD =
  process.env.SAFE_TEST_TUTOR_PASSWORD?.trim() ||
  `TestTutor-${crypto.randomBytes(6).toString("base64url")}!A1`;

function die(msg) {
  console.error(msg);
  process.exit(1);
}

if (process.env.ALLOW_SAFE_TEST_TUTOR !== "1") {
  die("Requires ALLOW_SAFE_TEST_TUTOR=1");
}
if (!process.argv.includes("--confirm")) die("Requires --confirm");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) die("Missing Supabase env");
const sb = createClient(url, key, { auth: { persistSession: false } });

const { data: staff } = await sb
  .from("profiles")
  .select("id, email")
  .like("email", "%@doncastergta.co.uk");
if ((staff || []).length !== 26) {
  die(`Refusing: real staff emails=${(staff || []).length}, expected 26`);
}

const { data: tutor, error } = await sb
  .from("profiles")
  .select("id, email, display_name, base_role, workspace, permissions")
  .eq("id", TUTOR_ID)
  .eq("email", TUTOR_EMAIL)
  .maybeSingle();
if (error) die(error.message);
if (!tutor) die("SAFE TEST tutor not found");
if (tutor.workspace !== "staff" || tutor.base_role !== "Tutor") {
  die("Refusing: target is not the SAFE TEST tutor profile");
}

const { error: pwErr } = await sb.auth.admin.updateUserById(TUTOR_ID, {
  password: PASSWORD,
  email_confirm: true,
});
if (pwErr) die(`Password update failed: ${pwErr.message}`);

const creds = {
  email: TUTOR_EMAIL,
  displayName: tutor.display_name,
  password: PASSWORD,
  workspace: "staff",
  baseRole: "Tutor",
  note: "SAFE TEST only. Not a real staff login. Password-only reset 14 Aug 2026.",
};
fs.mkdirSync(".tmp", { recursive: true });
fs.writeFileSync(
  ".tmp/safe-test-tutor-credentials.json",
  JSON.stringify(creds, null, 2),
);

const { data: staffAfter } = await sb
  .from("profiles")
  .select("id")
  .like("email", "%@doncastergta.co.uk");
if ((staffAfter || []).length !== 26) die("Real staff count changed");

console.log(
  JSON.stringify(
    {
      ok: true,
      email: TUTOR_EMAIL,
      password: PASSWORD,
      credentialsFile: ".tmp/safe-test-tutor-credentials.json",
      realStaffUnchanged: 26,
      profileUnchanged: {
        workspace: tutor.workspace,
        baseRole: tutor.base_role,
        permissions: tutor.permissions,
      },
    },
    null,
    2,
  ),
);
