import { workspaceForRole } from "./account-access";
import type {
  AdminPortalRole,
  AdminPortalUser,
  AdminProgrammeRecord,
  AdminStoreSnapshot,
} from "./types";

const now = new Date().toISOString();

/** Work email: firstnamesurname@doncastergta.co.uk (no dots/spaces). */
export function gtaWorkEmail(displayName: string): string {
  const local = displayName.toLowerCase().replace(/[^a-z]/g, "");
  return `${local}@doncastergta.co.uk`;
}

/**
 * Real GTA org staff for portal bootstrap.
 * Portal levels: Tutor | Administrator | Management.
 * Only Jon Mace, Annette Scott, Nicola Mitchell, and Reiss Chambers are Management.
 */
const GTA_ORG_STAFF: Array<{
  id: string;
  displayName: string;
  role: AdminPortalRole;
  jobTitles: string[];
  /** Live login already issued — show as enabled in Staff. */
  status?: "active" | "invited";
}> = [
  {
    id: "jon-mace",
    displayName: "Jon Mace",
    role: "Management",
    jobTitles: ["Chief Executive Officer"],
  },
  {
    id: "annette-scott",
    displayName: "Annette Scott",
    role: "Management",
    jobTitles: [
      "Administration Manager",
      "Company Secretary",
      "Director",
    ],
  },
  {
    id: "nicola-mitchell",
    displayName: "Nicola Mitchell",
    role: "Management",
    jobTitles: [
      "Operations Manager",
      "Quality & Safeguarding Lead",
      "DSL",
      "Ofsted Nominee",
    ],
  },
  {
    id: "reiss-chambers",
    displayName: "Reiss Chambers",
    role: "Management",
    jobTitles: ["Learning & Progress Mentor"],
    status: "active",
  },
  {
    id: "richard-appleyard",
    displayName: "Richard Appleyard",
    role: "Administrator",
    jobTitles: ["Awarding Body Standards & Compliance Officer"],
  },
  {
    id: "anne-marie-sanderson",
    displayName: "Anne-Marie Sanderson",
    role: "Administrator",
    jobTitles: ["Sales & Marketing", "Apprenticeship Tutor", "Deputy DSL"],
  },
  {
    id: "neil-corfield",
    displayName: "Neil Corfield",
    role: "Administrator",
    jobTitles: ["Sales & Marketing"],
  },
  {
    id: "rob-ruston",
    displayName: "Rob Ruston",
    role: "Administrator",
    jobTitles: ["FLT Instructor", "First Aid & Fire Marshal Lead"],
  },
  {
    id: "ian-kettleborough",
    displayName: "Ian Kettleborough",
    role: "Administrator",
    jobTitles: ["Logistics", "ADR CPC Trainer", "DGSA Trainer"],
  },
  {
    id: "rachael-allen",
    displayName: "Rachael Allen",
    role: "Administrator",
    jobTitles: ["Assistant Administration Manager"],
  },
  {
    id: "diane-meadows",
    displayName: "Diane Meadows",
    role: "Administrator",
    jobTitles: ["Receptionist"],
  },
  {
    id: "charlotte-mclaughlin",
    displayName: "Charlotte McLaughlin",
    role: "Administrator",
    jobTitles: ["Administration"],
  },
  {
    id: "trudy-hartley",
    displayName: "Trudy Hartley",
    role: "Administrator",
    jobTitles: ["Administration"],
  },
  {
    id: "lucy-butler",
    displayName: "Lucy Butler",
    role: "Administrator",
    jobTitles: ["Administration"],
  },
  {
    id: "john-pearson",
    displayName: "John Pearson",
    role: "Tutor",
    jobTitles: ["Apprenticeship Tutor – Bodyshop"],
  },
  {
    id: "andrew-ross",
    displayName: "Andrew Ross",
    role: "Tutor",
    jobTitles: ["Apprenticeship Tutor – Bodyshop"],
  },
  {
    id: "mike-hepworth",
    displayName: "Mike Hepworth",
    role: "Tutor",
    jobTitles: ["Apprenticeship Tutor – Mechanical"],
  },
  {
    id: "marc-hadfield",
    displayName: "Marc Hadfield",
    role: "Tutor",
    jobTitles: ["Apprenticeship Tutor – Mechanical"],
  },
  {
    id: "mark-illingworth",
    displayName: "Mark Illingworth",
    role: "Tutor",
    jobTitles: ["Apprenticeship Tutor – Mechanical"],
  },
  {
    id: "tony-reid",
    displayName: "Tony Reid",
    role: "Tutor",
    jobTitles: ["Apprenticeship Tutor – Mechanical"],
  },
  {
    id: "martin-farthing",
    displayName: "Martin Farthing",
    role: "Tutor",
    jobTitles: ["Apprenticeship Tutor – Mechanical"],
  },
  {
    id: "dan-hanmer",
    displayName: "Dan Hanmer",
    role: "Tutor",
    jobTitles: ["Apprenticeship Tutor – Mechanical"],
  },
  {
    id: "robert-mason",
    displayName: "Robert Mason",
    role: "Tutor",
    jobTitles: ["Apprenticeship Tutor – Mechanical"],
  },
  {
    id: "murtala-kasimu",
    displayName: "Murtala Kasimu",
    role: "Tutor",
    jobTitles: ["Apprenticeship Tutor – Mechanical"],
  },
  {
    id: "rebecca-harper",
    displayName: "Rebecca Harper",
    role: "Tutor",
    jobTitles: ["Learning Support and Inclusion Tutor", "Deputy DSL"],
  },
  {
    id: "benjamin-williams",
    displayName: "Benjamin Williams",
    role: "Tutor",
    jobTitles: [
      "Functional Skills and Inclusion Tutor",
      "Deputy DSL",
      "Ofsted Shadow Nominee",
    ],
  },
];

function seedOrgStaffUser(
  input: (typeof GTA_ORG_STAFF)[number],
): AdminPortalUser {
  const active = input.status === "active";
  return {
    id: `user-${input.id}`,
    displayName: input.displayName,
    email: gtaWorkEmail(input.displayName),
    role: input.role,
    workspace: workspaceForRole(input.role),
    jobTitles: [...input.jobTitles],
    linkedEnrolmentId: null,
    linkedApprenticeId: null,
    linkedEmployerId: null,
    programmeStartDate: null,
    status: active ? "active" : "invited",
    enabledBy: active ? input.displayName : null,
    enabledAt: active ? now : null,
    disabledBy: null,
    disabledAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

/** Programme catalogue from Temp Portal — apprenticeships GTA delivers. */
function seedProgrammes(): AdminProgrammeRecord[] {
  return [
    {
      id: "prog-autocare-l2",
      name: "Autocare Level 2",
      standardCode: "ST0499",
      level: 2,
      route: "Engineering and manufacturing",
      durationMonths: 30,
      awardingBody: "IMI / City & Guilds",
      status: "active",
      summary:
        "Official title: Autocare Technician. Carries out services and repairs on cars, car-derived vans and light goods vehicles in autocare or fast-fit centres.",
      skillsEnglandUrl:
        "https://skillsengland.education.gov.uk/apprenticeships/st0499-v1-3",
      notes: "Skills England reference ST0499 · Level 2 · typically 30 months.",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "prog-vmr-l3",
      name: "Vehicle Maintenance and Repair Level 3",
      standardCode: "ST0033",
      level: 3,
      route: "Engineering and manufacturing",
      durationMonths: 36,
      awardingBody: "IMI",
      status: "active",
      summary:
        "Official title: Motor vehicle service and maintenance technician – light vehicle. Servicing, inspecting, diagnosing and repairing light vehicles in dealerships or independent garages.",
      skillsEnglandUrl:
        "https://skillsengland.education.gov.uk/apprenticeships/st0033-v1-5",
      notes: "Skills England reference ST0033 · Level 3 · typically 36 months.",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "prog-hv-l3",
      name: "Heavy Vehicle Technician Level 3",
      standardCode: "ST0068",
      level: 3,
      route: "Engineering and manufacturing",
      durationMonths: 36,
      awardingBody: "IMI",
      status: "active",
      summary:
        "Official title: Heavy vehicle service and maintenance technician. Services, inspects and repairs heavy vehicles (N2/N3) and associated trailers, including diagnostics and roadside-related competence.",
      skillsEnglandUrl:
        "https://skillsengland.education.gov.uk/apprenticeships/st0068-v1-5",
      notes: "Skills England reference ST0068 · Level 3 · typically 36 months.",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "prog-paint-l3",
      name: "Vehicle Damage Paint Level 3",
      standardCode: "ST0448",
      level: 3,
      route: "Engineering and manufacturing",
      durationMonths: 36,
      awardingBody: "IMI",
      status: "active",
      summary:
        "Official title: Vehicle damage paint technician. Prepares, sprays and finishes cars and light commercial vehicles after collision or other damage to manufacturer and customer standards.",
      skillsEnglandUrl:
        "https://skillsengland.education.gov.uk/apprenticeships/st0448-v1-2",
      notes: "Skills England reference ST0448 · Level 3 · typically 36 months.",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "prog-panel-l3",
      name: "Vehicle Damage Panel Level 3",
      standardCode: "ST0403",
      level: 3,
      route: "Engineering and manufacturing",
      durationMonths: 36,
      awardingBody: "IMI",
      status: "active",
      summary:
        "Official title: Vehicle damage panel technician. Removes, repairs and replaces vehicle body panels to manufacturer specification in collision repair workshops.",
      skillsEnglandUrl:
        "https://skillsengland.education.gov.uk/apprenticeships/st0403-v1-3",
      notes: "Skills England reference ST0403 · Level 3 · typically 36 months.",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "prog-cs-practitioner",
      name: "Customer Service Level 2",
      standardCode: "ST0072",
      level: 2,
      route: "Sales, marketing and procurement",
      durationMonths: 12,
      awardingBody: "IMI / Institute of Customer Service",
      status: "active",
      summary:
        "Official title: Customer service practitioner. Delivers high-quality customer service face-to-face, by phone, digitally or in writing — the entry customer service standard often paired with Specialist.",
      skillsEnglandUrl:
        "https://skillsengland.education.gov.uk/apprenticeships/st0072-v1-1",
      notes:
        "Skills England sets this at Level 2 (not Level 3). Reference ST0072 · typically 12 months.",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "prog-cs-specialist-l3",
      name: "Customer Service Specialist Level 3",
      standardCode: "ST0071",
      level: 3,
      route: "Sales, marketing and procurement",
      durationMonths: 15,
      awardingBody: "IMI / Institute of Customer Service",
      status: "active",
      summary:
        "Official title: Customer service specialist. Handles complex or escalated customer requests, complaints and queries, and uses insight to improve service.",
      skillsEnglandUrl:
        "https://skillsengland.education.gov.uk/apprenticeships/st0071-v1-3",
      notes: "Skills England reference ST0071 · Level 3 · typically 15 months.",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "prog-business-admin-l3",
      name: "Business Administration Level 3",
      standardCode: "ST0070",
      level: 3,
      route: "Business and administration",
      durationMonths: 18,
      awardingBody: "Various EPAOs",
      status: "active",
      summary:
        "Official title: Business administrator. Supports and improves administrative services across teams, with strong IT, communication, planning and stakeholder skills.",
      skillsEnglandUrl:
        "https://skillsengland.education.gov.uk/apprenticeships/st0070-v1-0",
      notes: "Skills England reference ST0070 · Level 3 · typically 12–18 months.",
      createdAt: now,
      updatedAt: now,
    },
  ];
}

/**
 * Clean bootstrap snapshot — no fictional apprentices/employers/cohorts.
 * Staff = real GTA org chart with @doncastergta.co.uk emails.
 */
export function createSeedSnapshot(): AdminStoreSnapshot {
  return {
    version: 19,
    apprentices: [],
    enrolments: [],
    employers: [],
    programmes: seedProgrammes(),
    cohorts: [],
    teachingGroups: [],
    cohortChangeLogs: [],
    users: GTA_ORG_STAFF.map(seedOrgStaffUser),
  };
}
