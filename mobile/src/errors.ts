export function explainAddressBookError(message: string, code?: string): string {
  const lower = `${code ?? ""} ${message}`.toLowerCase();
  if (
    lower.includes("portal_address_book") ||
    lower.includes("schema cache") ||
    lower.includes("pgrst205") ||
    lower.includes("42p01") ||
    lower.includes("does not exist")
  ) {
    return "The address book is not available yet. Apply the portal_address_book migration in Supabase, then try again.";
  }
  if (lower.includes("permission") || lower.includes("42501") || lower.includes("row-level")) {
    return "Your account is not allowed to read these contacts.";
  }
  return "Contacts could not be loaded. Check your connection and try again.";
}

export function explainSignInError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("captcha")) {
    return "Sign-in was blocked by the Portal security check. Phone sign-in uses email and password only.";
  }
  if (lower.includes("invalid login") || lower.includes("invalid credentials")) {
    return "That email or password was not recognised.";
  }
  return message.trim() || "Unable to sign in.";
}
