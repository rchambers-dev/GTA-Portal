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
  site: string;
  manager: string;
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
    site: "Example yard",
    manager: "Example Manager",
  },
  {
    id: "example-yard-co",
    name: "Example Yard Co",
    phone: "00000 200200",
    postcode: "EX2 2EX",
    site: "Example yard",
    manager: "",
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
    employers: EXAMPLE_EMPLOYERS.map((row) => ({ ...row })),
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
  site: string;
  manager: string;
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
  | { type: "set-site"; site: string }
  | { type: "set-manager"; manager: string }
  | { type: "add-local" };

export function initialEmployerPreviewState(): EmployerPreviewState {
  return {
    query: "",
    addOpen: false,
    name: "",
    phone: "",
    postcode: "",
    site: "",
    manager: "",
    rows: EXAMPLE_EMPLOYERS.map((row) => ({ ...row })),
    notice: "",
  };
}

export function visibleEmployers(state: EmployerPreviewState): ExampleEmployer[] {
  const query = state.query.trim().toLowerCase();
  if (!query) return state.rows;
  return state.rows.filter((row) =>
    [row.name, row.phone, row.postcode, row.site, row.manager]
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
            site: "",
            manager: "",
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
        site: "",
        manager: "",
        notice: "",
      };
    case "set-name":
      return { ...state, name: action.name };
    case "set-phone":
      return { ...state, phone: action.phone };
    case "set-postcode":
      return { ...state, postcode: action.postcode };
    case "set-site":
      return { ...state, site: action.site };
    case "set-manager":
      return { ...state, manager: action.manager };
    case "add-local": {
      const name = state.name.trim();
      if (!name) return { ...state, notice: "Company name is required." };
      return {
        ...state,
        addOpen: false,
        name: "",
        phone: "",
        postcode: "",
        site: "",
        manager: "",
        notice: "Not saved. Saving is disabled.",
        rows: [
          ...state.rows,
          {
            id: `local-employer-${state.rows.length + 1}`,
            name,
            phone: state.phone.trim(),
            postcode: state.postcode.trim(),
            site: state.site.trim(),
            manager: state.manager.trim(),
          },
        ],
      };
    }
    default:
      return state;
  }
}
