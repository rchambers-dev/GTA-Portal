import { loadSearchDirectory, parseSearchFilter, type SearchDirectory } from "../domain/search-directory";
import { SearchView } from "./SearchView";

export async function SearchScreen({
  workspace,
  q,
  filter,
}: {
  workspace: "staff" | "administration" | "management";
  q?: string;
  filter?: string;
}) {
  const query = q?.trim() ?? "";
  const selected = parseSearchFilter(filter);
  const page: SearchDirectory = query
    ? await loadSearchDirectory(query, selected)
    : { query, filter: selected, learners: [], employers: [], candidates: [], loadError: null };
  return <SearchView workspace={workspace} page={page} />;
}
