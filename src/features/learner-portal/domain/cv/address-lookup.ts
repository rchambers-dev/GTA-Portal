/**
 * Client helper for UK address lookup (house number + postcode → selectable line).
 * Talks to /api/address/lookup — never call third-party address APIs from the browser.
 */

export type AddressSuggestion = {
  id: string;
  /** Short label for the picker list. */
  label: string;
  /** Full line stored on the CV and shown in the preview. */
  line: string;
};

export type AddressLookupResult = {
  suggestions: AddressSuggestion[];
  /** Which backend resolved the list (for debugging / support). */
  provider?: string;
};

export async function lookupUkAddress(
  houseNumber: string,
  postcode: string,
): Promise<AddressLookupResult> {
  const house = houseNumber.trim();
  const code = postcode.trim();
  if (!house || !code) {
    throw new Error("Enter a house number and postcode first.");
  }

  const params = new URLSearchParams({
    house: house,
    postcode: code,
  });
  const res = await fetch(`/api/address/lookup?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  const body = (await res.json().catch(() => null)) as {
    error?: string;
    suggestions?: AddressSuggestion[];
    provider?: string;
  } | null;

  if (!res.ok) {
    throw new Error(body?.error || "Address lookup failed. Try again.");
  }

  const suggestions = Array.isArray(body?.suggestions) ? body.suggestions : [];
  if (suggestions.length === 0) {
    throw new Error(
      "No address found for that house number and postcode. Check both and try again.",
    );
  }

  return {
    suggestions,
    provider: typeof body?.provider === "string" ? body.provider : undefined,
  };
}
