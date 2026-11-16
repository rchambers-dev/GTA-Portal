"use server";

import { revalidatePath } from "next/cache";

/** Drop any cached Analytics page so the next render reads the database. */
export async function revalidateAnalytics(): Promise<void> {
  revalidatePath("/administration/reviews/analytics");
  revalidatePath("/management/reviews/analytics");
}
