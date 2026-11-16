import { explainAddressBookError } from "./errors";
import { mapAddressBookRow } from "./map-contact";
import type { PortalClient } from "./supabase";
import type { AddressBookRow, RawAddressBookRow } from "./types";

const COLUMNS =
  "contact_group,source_id,contact_key,given_name,middle_name,family_name,display_name,email,phone,organisation,job_title,detail";

const PAGE = 1000;

/** Read the address book. This function never inserts, updates, or deletes. */
export async function fetchAddressBook(client: PortalClient): Promise<AddressBookRow[]> {
  const rows: AddressBookRow[] = [];
  for (let from = 0; from < 50_000; from += PAGE) {
    const { data, error } = await client
      .from("portal_address_book")
      .select(COLUMNS)
      .order("contact_key", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(explainAddressBookError(error.message, error.code));
    const page = (data ?? []) as RawAddressBookRow[];
    for (const row of page) {
      const mapped = mapAddressBookRow(row);
      if (mapped) rows.push(mapped);
    }
    if (page.length < PAGE) return rows;
  }
  throw new Error("The address book is larger than this app can read in one go.");
}
