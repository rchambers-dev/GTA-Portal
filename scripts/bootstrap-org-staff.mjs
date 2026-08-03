/**
 * Upsert all GTA org staff into auth.users + profiles.
 * Idempotent by email. Does not reset passwords for existing users.
 *
 * Usage:
 *   BOOTSTRAP_ORG_STAFF_PASSWORD=... npm run bootstrap:org-staff
 * (password only used when creating NEW auth users)
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const out = {};
  const envPath = path.resolve(".env.local");
  if (!fs.existsSync(envPath)) return out;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const env = { ...process.env, ...loadEnvLocal() };
const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const defaultPassword =
  env.BOOTSTRAP_ORG_STAFF_PASSWORD?.trim() ||
  env.BOOTSTRAP_SUPERADMIN_PASSWORD?.trim() ||
  `GtaStaff-${Math.random().toString(36).slice(2, 10)}!A1`;

console.log(
  env.BOOTSTRAP_ORG_STAFF_PASSWORD || env.BOOTSTRAP_SUPERADMIN_PASSWORD
    ? "Using BOOTSTRAP_* password for any newly created staff logins."
    : `Generated one-time password for new staff logins (save if needed): ${defaultPassword}`,
);

if (!url || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

function gtaWorkEmail(displayName) {
  const local = displayName.toLowerCase().replace(/[^a-z]/g, "");
  return `${local}@doncastergta.co.uk`;
}

function workspaceForRole(role) {
  switch (role) {
    case "Management":
    case "Owner":
      return "management";
    case "Administrator":
      return "administration";
    case "Quality":
      return "quality";
    case "Tutor":
    case "Learning and Progress Mentor":
      return "staff";
    default:
      return "staff";
  }
}

function permissionsForRole(role) {
  const base = ["messages.view", "ai.use"];
  if (role === "Management" || role === "Owner") {
    return [
      ...base,
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
      "staff.workspace.view",
    ];
  }
  if (role === "Administrator") {
    return [
      ...base,
      "admin.workspace.view",
      "admin.users.manage",
      "admin.records.manage",
      "records.proxy.write",
      "lifecycle.kanban.view",
      "apprentice.workspace.view",
      "staff.workspace.view",
    ];
  }
  return [
    ...base,
    "staff.workspace.view",
    "apprentices.assigned.view",
    "apprentice.workspace.view",
    "modules.deliver",
    "lifecycle.kanban.view",
  ];
}

/** Same roster as src/features/administration/domain/seed.ts */
const GTA_ORG_STAFF = [
  {
    displayName: "Jon Mace",
    role: "Management",
    jobTitles: ["Chief Executive Officer"],
  },
  {
    displayName: "Annette Scott",
    role: "Management",
    jobTitles: ["Administration Manager", "Company Secretary", "Director"],
  },
  {
    displayName: "Nicola Mitchell",
    role: "Management",
    jobTitles: [
      "Operations Manager",
      "Quality & Safeguarding Lead",
      "DSL",
      "Ofsted Nominee",
    ],
  },
  {
    displayName: "Reiss Chambers",
    role: "Management",
    jobTitles: ["Learning & Progress Mentor"],
    status: "active",
  },
  {
    displayName: "Richard Appleyard",
    role: "Administrator",
    jobTitles: ["Awarding Body Standards & Compliance Officer"],
  },
  {
    displayName: "Anne-Marie Sanderson",
    role: "Administrator",
    jobTitles: ["Sales & Marketing", "Apprenticeship Tutor", "Deputy DSL"],
  },
  {
    displayName: "Neil Corfield",
    role: "Administrator",
    jobTitles: ["Sales & Marketing"],
  },
  {
    displayName: "Rob Ruston",
    role: "Administrator",
    jobTitles: ["FLT Instructor", "First Aid & Fire Marshal Lead"],
  },
  {
    displayName: "Ian Kettleborough",
    role: "Administrator",
    jobTitles: ["Logistics", "ADR CPC Trainer", "DGSA Trainer"],
  },
  {
    displayName: "Rachael Allen",
    role: "Administrator",
    jobTitles: ["Assistant Administration Manager"],
  },
  {
    displayName: "Diane Meadows",
    role: "Administrator",
    jobTitles: ["Receptionist"],
  },
  {
    displayName: "Charlotte McLaughlin",
    role: "Administrator",
    jobTitles: ["Administration"],
  },
  {
    displayName: "Trudy Hartley",
    role: "Administrator",
    jobTitles: ["Administration"],
  },
  {
    displayName: "Lucy Butler",
    role: "Administrator",
    jobTitles: ["Administration"],
  },
  {
    displayName: "John Pearson",
    role: "Tutor",
    jobTitles: ["Apprenticeship Tutor – Bodyshop"],
  },
  {
    displayName: "Andrew Ross",
    role: "Tutor",
    jobTitles: ["Apprenticeship Tutor – Bodyshop"],
  },
  {
    displayName: "Mike Hepworth",
    role: "Tutor",
    jobTitles: ["Apprenticeship Tutor – Mechanical"],
  },
  {
    displayName: "Marc Hadfield",
    role: "Tutor",
    jobTitles: ["Apprenticeship Tutor – Mechanical"],
  },
  {
    displayName: "Mark Illingworth",
    role: "Tutor",
    jobTitles: ["Apprenticeship Tutor – Mechanical"],
  },
  {
    displayName: "Tony Reid",
    role: "Tutor",
    jobTitles: ["Apprenticeship Tutor – Mechanical"],
  },
  {
    displayName: "Martin Farthing",
    role: "Tutor",
    jobTitles: ["Apprenticeship Tutor – Mechanical"],
  },
  {
    displayName: "Dan Hanmer",
    role: "Tutor",
    jobTitles: ["Apprenticeship Tutor – Mechanical"],
  },
  {
    displayName: "Robert Mason",
    role: "Tutor",
    jobTitles: ["Apprenticeship Tutor – Mechanical"],
  },
  {
    displayName: "Murtala Kasimu",
    role: "Tutor",
    jobTitles: ["Apprenticeship Tutor – Mechanical"],
  },
  {
    displayName: "Rebecca Harper",
    role: "Tutor",
    jobTitles: ["Learning Support and Inclusion Tutor", "Deputy DSL"],
  },
  {
    displayName: "Benjamin Williams",
    role: "Tutor",
    jobTitles: [
      "Functional Skills and Inclusion Tutor",
      "Deputy DSL",
      "Ofsted Shadow Nominee",
    ],
  },
];

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: listed, error: listError } = await supabase.auth.admin.listUsers({
  page: 1,
  perPage: 200,
});
if (listError) throw listError;

const byEmail = new Map(
  (listed.users ?? []).map((u) => [u.email?.toLowerCase() ?? "", u]),
);

let created = 0;
let updated = 0;

for (const person of GTA_ORG_STAFF) {
  const email = gtaWorkEmail(person.displayName);
  const existing = byEmail.get(email);
  let userId = existing?.id;

  if (!userId) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: defaultPassword,
      email_confirm: true,
      user_metadata: {
        display_name: person.displayName,
        username: person.displayName.split(/\s+/)[0] || "Staff",
      },
    });
    if (error || !data.user) {
      console.error(`Auth create failed for ${email}:`, error?.message);
      continue;
    }
    userId = data.user.id;
    created += 1;
    console.log(`Created auth user ${email}`);
  }

  const active = person.status === "active";
  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: userId,
      email,
      username: person.displayName.split(/\s+/)[0] || "Staff",
      display_name: person.displayName,
      base_role: person.role,
      workspace: workspaceForRole(person.role),
      permissions: permissionsForRole(person.role),
      responsibilities: person.jobTitles,
      department: person.jobTitles[0] ?? "",
      portal_status: active ? "active" : "invited",
      enabled_by: active ? person.displayName : null,
      enabled_at: active ? new Date().toISOString() : null,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    console.error(`Profile upsert failed for ${email}:`, profileError.message);
    continue;
  }
  updated += 1;
  console.log(`Profile OK ${email} (${person.role})`);
}

console.log(
  `Done. Auth created: ${created}. Profiles upserted: ${updated}.`,
);
