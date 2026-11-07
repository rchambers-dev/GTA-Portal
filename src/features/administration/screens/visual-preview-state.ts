/**
 * Local preview state only. These transitions never call the network.
 * The Reviews Learners screen was not available in this workspace, so this
 * models the requested search, row list, and expandable add container.
 */

export type ExampleEmployer = {
  id: string;
  name: string;
  phone: string;
  postcode: string;
  sites: string[];
  managers: string[];
};

export type DraftEntry = {
  id: string;
  label: string;
};

export type ExampleApprentice = {
  id: string;
  fullName: string;
  employerId: string;
};

export const EXAMPLE_EMPLOYERS: ExampleEmployer[] = [
  {
    id: "example-motors",
    name: "Example Motors",
    phone: "00000 100100",
    postcode: "EX1 1EX",
    sites: ["Example yard"],
    managers: ["Example Manager"],
  },
  {
    id: "example-yard-co",
    name: "Example Yard Co",
    phone: "00000 200200",
    postcode: "EX2 2EX",
    sites: ["Example yard"],
    managers: [],
  },
];

export const EXAMPLE_APPRENTICES: ExampleApprentice[] = [
  { id: "example-alex", fullName: "Alex Example", employerId: "" },
  { id: "example-jordan", fullName: "Jordan Example", employerId: "example-motors" },
];

export function employerName(employerId: string, employers: ExampleEmployer[]): string {
  if (!employerId) return "Not linked";
  return employers.find((row) => row.id === employerId)?.name ?? "Not linked";
}

export type ApprenticePreviewState = {
  query: string;
  addOpen: boolean;
  fullName: string;
  employerId: string;
  rows: ExampleApprentice[];
  employers: ExampleEmployer[];
  notice: string;
};

export type ApprenticePreviewAction =
  | { type: "search"; query: string }
  | { type: "toggle-add" }
  | { type: "cancel-add" }
  | { type: "set-name"; fullName: string }
  | { type: "set-employer"; employerId: string }
  | { type: "add-local" };

export function initialApprenticePreviewState(): ApprenticePreviewState {
  return {
    query: "",
    addOpen: false,
    fullName: "",
    employerId: "",
    rows: EXAMPLE_APPRENTICES.map((row) => ({ ...row })),
    employers: EXAMPLE_EMPLOYERS.map((row) => ({
      ...row,
      sites: [...row.sites],
      managers: [...row.managers],
    })),
    notice: "",
  };
}

export function visibleApprentices(state: ApprenticePreviewState): ExampleApprentice[] {
  const query = state.query.trim().toLowerCase();
  if (!query) return state.rows;
  return state.rows.filter((row) => {
    const employer = employerName(row.employerId, state.employers).toLowerCase();
    return row.fullName.toLowerCase().includes(query) || employer.includes(query);
  });
}

export function apprenticePreviewReducer(
  state: ApprenticePreviewState,
  action: ApprenticePreviewAction,
): ApprenticePreviewState {
  switch (action.type) {
    case "search":
      return { ...state, query: action.query };
    case "toggle-add":
      return state.addOpen
        ? { ...state, addOpen: false, fullName: "", employerId: "", notice: "" }
        : { ...state, addOpen: true, notice: "" };
    case "cancel-add":
      return { ...state, addOpen: false, fullName: "", employerId: "", notice: "" };
    case "set-name":
      return { ...state, fullName: action.fullName };
    case "set-employer":
      return { ...state, employerId: action.employerId };
    case "add-local": {
      const fullName = state.fullName.trim();
      if (!fullName) {
        return { ...state, notice: "Full name is required." };
      }
      return {
        ...state,
        addOpen: false,
        fullName: "",
        employerId: "",
        notice: "Not saved. Saving is disabled.",
        rows: [
          ...state.rows,
          { id: `local-apprentice-${state.rows.length + 1}`, fullName, employerId: state.employerId },
        ],
      };
    }
    default:
      return state;
  }
}

export type EmployerPreviewState = {
  query: string;
  addOpen: boolean;
  name: string;
  phone: string;
  postcode: string;
  sites: DraftEntry[];
  managers: DraftEntry[];
  entrySeq: number;
  rows: ExampleEmployer[];
  notice: string;
};

export type EmployerPreviewAction =
  | { type: "search"; query: string }
  | { type: "toggle-add" }
  | { type: "cancel-add" }
  | { type: "set-name"; name: string }
  | { type: "set-phone"; phone: string }
  | { type: "set-postcode"; postcode: string }
  | { type: "add-site" }
  | { type: "set-site"; id: string; label: string }
  | { type: "remove-site"; id: string }
  | { type: "add-manager" }
  | { type: "set-manager"; id: string; label: string }
  | { type: "remove-manager"; id: string }
  | { type: "add-local" };

function blankEmployerEntries(): Pick<EmployerPreviewState, "sites" | "managers" | "entrySeq"> {
  return {
    sites: [{ id: "site-1", label: "" }],
    managers: [{ id: "manager-1", label: "" }],
    entrySeq: 1,
  };
}

function filledLabels(entries: DraftEntry[]): string[] {
  return entries.map((entry) => entry.label.trim()).filter(Boolean);
}

function withEntry(
  entries: DraftEntry[],
  id: string,
  label: string,
): DraftEntry[] {
  return entries.map((entry) => (entry.id === id ? { ...entry, label } : entry));
}

function withoutEntry(
  entries: DraftEntry[],
  id: string,
  kind: "site" | "manager",
  entrySeq: number,
): { entries: DraftEntry[]; entrySeq: number } {
  const remaining = entries.filter((entry) => entry.id !== id);
  if (remaining.length > 0) return { entries: remaining, entrySeq };
  const nextSeq = entrySeq + 1;
  return {
    entries: [{ id: `${kind}-${nextSeq}`, label: "" }],
    entrySeq: nextSeq,
  };
}

export function employerMeta(row: ExampleEmployer): string {
  const sites = row.sites.map((item) => item.trim()).filter(Boolean);
  const managers = row.managers.map((item) => item.trim()).filter(Boolean);
  return [
    row.phone,
    row.postcode,
    sites.length > 0 ? sites.join(", ") : "No site",
    managers.length > 0 ? managers.join(", ") : "No manager",
  ]
    .filter(Boolean)
    .join(" · ");
}

export function initialEmployerPreviewState(): EmployerPreviewState {
  return {
    query: "",
    addOpen: false,
    name: "",
    phone: "",
    postcode: "",
    ...blankEmployerEntries(),
    rows: EXAMPLE_EMPLOYERS.map((row) => ({
      ...row,
      sites: [...row.sites],
      managers: [...row.managers],
    })),
    notice: "",
  };
}

export function visibleEmployers(state: EmployerPreviewState): ExampleEmployer[] {
  const query = state.query.trim().toLowerCase();
  if (!query) return state.rows;
  return state.rows.filter((row) =>
    [row.name, row.phone, row.postcode, ...row.sites, ...row.managers]
      .join(" ")
      .toLowerCase()
      .includes(query),
  );
}

export function employerPreviewReducer(
  state: EmployerPreviewState,
  action: EmployerPreviewAction,
): EmployerPreviewState {
  switch (action.type) {
    case "search":
      return { ...state, query: action.query };
    case "toggle-add":
      return state.addOpen
        ? {
            ...state,
            addOpen: false,
            name: "",
            phone: "",
            postcode: "",
            ...blankEmployerEntries(),
            notice: "",
          }
        : { ...state, addOpen: true, notice: "" };
    case "cancel-add":
      return {
        ...state,
        addOpen: false,
        name: "",
        phone: "",
        postcode: "",
        ...blankEmployerEntries(),
        notice: "",
      };
    case "set-name":
      return { ...state, name: action.name };
    case "set-phone":
      return { ...state, phone: action.phone };
    case "set-postcode":
      return { ...state, postcode: action.postcode };
    case "add-site": {
      const entrySeq = state.entrySeq + 1;
      return {
        ...state,
        entrySeq,
        sites: [...state.sites, { id: `site-${entrySeq}`, label: "" }],
      };
    }
    case "set-site":
      return { ...state, sites: withEntry(state.sites, action.id, action.label) };
    case "remove-site": {
      const next = withoutEntry(state.sites, action.id, "site", state.entrySeq);
      return { ...state, entrySeq: next.entrySeq, sites: next.entries };
    }
    case "add-manager": {
      const entrySeq = state.entrySeq + 1;
      return {
        ...state,
        entrySeq,
        managers: [...state.managers, { id: `manager-${entrySeq}`, label: "" }],
      };
    }
    case "set-manager":
      return { ...state, managers: withEntry(state.managers, action.id, action.label) };
    case "remove-manager": {
      const next = withoutEntry(state.managers, action.id, "manager", state.entrySeq);
      return { ...state, entrySeq: next.entrySeq, managers: next.entries };
    }
    case "add-local": {
      const name = state.name.trim();
      if (!name) return { ...state, notice: "Company name is required." };
      return {
        ...state,
        addOpen: false,
        name: "",
        phone: "",
        postcode: "",
        ...blankEmployerEntries(),
        notice: "Not saved. Saving is disabled.",
        rows: [
          ...state.rows,
          {
            id: `local-employer-${state.rows.length + 1}`,
            name,
            phone: state.phone.trim(),
            postcode: state.postcode.trim(),
            sites: filledLabels(state.sites),
            managers: filledLabels(state.managers),
          },
        ],
      };
    }
    default:
      return state;
  }
}
