// The server path for creating a staff login. New accounts must change the
// password they were given. The flag lives in app_metadata, which the user
// cannot edit. Dashboard inserts are covered by the password-flag migration's
// trigger, which sets the same default.

export function newStaffAppMetadata(role) {
  return {
    role: String(role || "").trim().toLowerCase(),
    password_changed: false,
  };
}

export async function createStaffUser(client, { email, password, role }) {
  const app_metadata = newStaffAppMetadata(role);
  const { data, error } = await client.auth.admin.createUser({
    email: String(email || "").trim(),
    password,
    email_confirm: true,
    app_metadata,
  });
  if (error) {
    const failure = new Error("Could not create the user.");
    failure.status = 400;
    failure.code = error.code;
    throw failure;
  }
  return data?.user;
}
