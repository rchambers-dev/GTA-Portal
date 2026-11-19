import { describe, expect, it } from "vitest";
import { searchDirectoryRows, type SearchCandidate, type SearchEmployer, type SearchLearner } from "./search-directory";

const learners: SearchLearner[] = [
  {
    gtaId: "GTA-000012",
    name: "Joel Richardson",
    detail: "BCA · Doncaster depot · DN1 2AA",
    searchText: "Joel Richardson GTA-000012 BCA Doncaster depot DN1 2AA Dan Hanmer",
    inLearning: true,
    reviewDue: true,
    concern: false,
    statusLabel: "In learning",
  },
  {
    gtaId: "GTA-000044",
    name: "Amina Shah",
    detail: "BCA · Balby site",
    searchText: "Amina Shah GTA-000044 BCA Balby",
    inLearning: false,
    reviewDue: false,
    concern: true,
    statusLabel: "Completed",
  },
];

const employers: SearchEmployer[] = [
  { id: "GTA-EMP-000001", name: "BCA", detail: "4 sites", searchText: "BCA GTA-EMP-000001 Doncaster DN1 2AA" },
];

const candidates: SearchCandidate[] = [
  {
    id: "GTA-C-000042",
    name: "Maya Henshaw",
    detail: "BCA · employer needed",
    searchText: "Maya Henshaw GTA-C-000042 BCA",
    statusLabel: "Active",
    active: true,
    reviewDue: true,
  },
];

describe("search directory", () => {
  it("searches learners, employers and candidates, and keeps people who have left", () => {
    const open = searchDirectoryRows({ needle: "bca", filter: "all", learners, employers, candidates });
    expect(open.learners.map((row) => row.name)).toEqual(["Amina Shah", "Joel Richardson"]);
    expect(open.employers).toHaveLength(1);
    expect(open.candidates.map((row) => row.id)).toEqual(["GTA-C-000042"]);
  });

  it("narrows only learners when In learning is on", () => {
    const learning = searchDirectoryRows({ needle: "bca", filter: "in_learning", learners, employers, candidates });
    expect(learning.learners.map((row) => row.name)).toEqual(["Joel Richardson"]);
    expect(learning.employers.map((row) => row.name)).toEqual(["BCA"]);
    expect(learning.candidates.map((row) => row.id)).toEqual(["GTA-C-000042"]);
  });

  it("keeps review due and concern on the people who have them", () => {
    const due = searchDirectoryRows({ needle: "bca", filter: "review_due", learners, employers, candidates });
    expect(due.learners.map((row) => row.gtaId)).toEqual(["GTA-000012"]);
    expect(due.candidates.map((row) => row.id)).toEqual(["GTA-C-000042"]);
    expect(due.employers).toHaveLength(0);
    const concern = searchDirectoryRows({ needle: "bca", filter: "concern", learners, employers, candidates });
    expect(concern.learners.map((row) => row.name)).toEqual(["Amina Shah"]);
    expect(concern.employers).toHaveLength(0);
    expect(concern.candidates).toHaveLength(0);
  });
});
