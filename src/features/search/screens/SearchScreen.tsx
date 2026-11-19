import { loadSearchDirectory, parseSearchFilter, shownCount } from "../domain/search-directory";
import { SearchView } from "./SearchView";

export async function SearchScreen({
  workspace,
  q,
  filter,
  learners,
  employers,
  applicants,
}: {
  workspace: "staff" | "administration" | "management";
  q?: string;
  filter?: string;
  learners?: string;
  employers?: string;
  applicants?: string;
}) {
  const query = q?.trim() ?? "";
  const selected = parseSearchFilter(filter);
  const page = await loadSearchDirectory(query, selected, {
    learners: shownCount(learners),
    employers: shownCount(employers),
    applicants: shownCount(applicants),
  });
  return <SearchView workspace={workspace} page={page} />;
}
