// Authorization uses app_metadata.role only. user_metadata is writable by
// the signed-in user, so a role stored there grants nothing.

export function staffRole(user) {
  const role = user?.app_metadata?.role;
  if (typeof role !== "string") return "";
  return role.trim().toLowerCase();
}
