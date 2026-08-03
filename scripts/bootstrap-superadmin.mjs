import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const password = process.env.BOOTSTRAP_SUPERADMIN_PASSWORD?.trim();
const   email =
  process.env.BOOTSTRAP_SUPERADMIN_EMAIL?.trim().toLowerCase() ||
  "reisschambers@doncastergta.co.uk";

if (!url) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
}

if (!serviceRoleKey) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
}

if (!password) {
  throw new Error("Missing BOOTSTRAP_SUPERADMIN_PASSWORD");
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const permissions = [
  "management.workspace.view",
  "management.programme.setup",
  "management.roles.assign",
  "management.curriculum.health",
  "management.employer.concerns",
  "admin.users.manage",
  "admin.records.manage",
  "records.proxy.write",
  "lifecycle.kanban.view",
  "apprentice.workspace.view",
  "messages.view",
];

const { data: existingUsers, error: listError } =
  await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });

if (listError) throw listError;

const existing = existingUsers.users.find(
  (user) => user.email?.toLowerCase() === email,
);

const authUser =
  existing ??
  (
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: "Reiss Chambers",
        username: "reisschambers",
      },
    })
  ).data.user;

if (!authUser?.id) {
  throw new Error("Unable to create or load management auth user");
}

const { error: profileError } = await supabase.from("profiles").upsert(
  {
    id: authUser.id,
    email,
    username: "reisschambers",
    display_name: "Reiss Chambers",
    base_role: "Management",
    workspace: "management",
    permissions,
    responsibilities: [],
  },
  { onConflict: "id" },
);

if (profileError) throw profileError;

console.log(`Management login ready: ${email}`);
