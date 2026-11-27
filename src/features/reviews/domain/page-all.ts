/** Read every row past the PostgREST default cap. Stops when a page is short or a query fails. */

const PAGE = 1000;
const MAX_ROWS = 20000;

export async function pageAll<T>(
  load: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const data: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const page = await load(from, from + PAGE - 1);
    if (page.error) {
      console.error("A review query failed.", page.error.message);
      return { data: [], error: page.error };
    }
    const batch = page.data ?? [];
    data.push(...batch);
    if (batch.length < PAGE) return { data, error: null };
  }
  return { data, error: null };
}

export const REVIEW_LOAD_ERROR = "Reviews could not be loaded. The figures are hidden until the data is available.";
