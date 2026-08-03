import { useCallback, useEffect, useMemo, useState } from "react";

export type AgreementAudience = "apprentice" | "employer" | "mentor";

export type AgreementSignature = {
  signed: boolean;
  signedAt: string | null;
  signedBy: string | null;
};

export type TrainingPlanAgreementState = {
  apprentice: AgreementSignature;
  employer: AgreementSignature;
  mentor: AgreementSignature & { note: string };
};

export type AgreementSection = {
  id: string;
  title: string;
  intro?: string;
  items: string[];
};

export const TRAINING_PLAN_PROVIDER_SECTIONS: AgreementSection[] = [
  {
    id: "provider-eligibility",
    title: "Main Provider eligibility checks",
    items: [
      "Check the apprentice has the right to work in the UK and no known restrictions prevent completion of the apprenticeship.",
      "Check the apprentice spends at least 50% of working time in England.",
      "Check the apprentice is not on another apprenticeship or another DfE-funded programme at the same time.",
      "Check the apprentice has not been asked to financially contribute toward the apprenticeship.",
    ],
  },
  {
    id: "provider-employer-checks",
    title: "Main Provider checks with the employer",
    items: [
      "Offer the free Recruit an Apprentice service for new recruits.",
      "Confirm the contract of service is long enough to complete the apprenticeship and EPA.",
      "Confirm the apprenticeship agreement is signed and the apprentice is paid a lawful wage.",
      "Confirm the apprenticeship is the most suitable programme and that off-the-job training will be allowed during working hours.",
      "Confirm the apprentice will receive appropriate support and supervision.",
    ],
  },
  {
    id: "provider-training-plan",
    title: "Training plan, price and delivery",
    items: [
      "Build the training plan from initial assessment, English and maths level, learning support needs, off-the-job minimums, and any subcontracted delivery.",
      "Negotiate price with the employer, including prior learning, bursaries, waivers, and co-investment where applicable.",
      "Provide induction, learning materials, attendance follow-up, delivery oversight, quality assurance, certification, and regular tripartite reviews no more than 12 weeks apart.",
      "Update the training plan when needed and agree readiness for end-point assessment with the employer and apprentice.",
      "Complete ILR and funding administration, try to secure alternative employment if redundancy happens, and work to resolve complaints.",
    ],
  },
];

export const TRAINING_PLAN_EMPLOYER_SECTIONS: AgreementSection[] = [
  {
    id: "employer-responsibilities",
    title: "Employer responsibilities",
    items: [
      "Work with the provider to identify the most suitable apprenticeship standard.",
      "Support apprentice eligibility checks and confirm the apprenticeship is the most suitable programme for the individual.",
      "Confirm prior learning has been identified and reflected in the design of the training plan.",
      "Ensure the job role has a productive purpose and allows the apprentice to build the required knowledge, skills, and behaviours.",
      "Release the apprentice for off-the-job training, English and maths where required, during paid working hours.",
      "Provide workplace support, supervision, and opportunities to practise and embed new skills.",
      "Contribute to tripartite reviews, evidence collection, readiness decisions, complaints resolution, and EPAO selection at least 6 months before gateway.",
    ],
  },
  {
    id: "employer-confirms",
    title: "Employer confirms",
    items: [
      "The apprentice has a contract long enough to complete the apprenticeship and end-point assessment.",
      "The apprentice will spend at least 50% of working hours in England over the programme.",
      "The apprentice will be paid a lawful wage for both work and off-the-job training time.",
      "Off-the-job hours in the training plan will be completed in normal paid working hours.",
      "The apprentice is included in the employer PAYE scheme declared on the apprenticeship service.",
      "The apprentice has not been and will not be asked to financially contribute toward the apprenticeship.",
      "If levy funds run out, the employer understands co-investment obligations may apply.",
    ],
  },
];

export const TRAINING_PLAN_APPRENTICE_SECTIONS: AgreementSection[] = [
  {
    id: "apprentice-responsibilities",
    title: "Apprentice responsibilities",
    items: [
      "Provide relevant information to support apprentice and programme eligibility checks.",
      "Follow policies and procedures within the training plan.",
      "Attend required off-the-job training and notify the provider and employer of non-attendance where possible in advance.",
      "Commit to module learning activities, self-study, research, coursework, assignments, and exams required for the apprenticeship.",
      "Help collect evidence of off-the-job training and contribute to progress reviews.",
      "Raise any issues that may affect the training plan, including learning support or health concerns.",
      "Agree readiness for end-point assessment with the employer and provider when learning is complete.",
    ],
  },
  {
    id: "apprentice-confirms",
    title: "Apprentice confirms",
    items: [
      "They have not been asked to contribute financially toward any part of the apprenticeship.",
      "They are not undertaking another apprenticeship or another AEB / DfE-funded programme.",
      "They have the right to work in England.",
      "They have read and understood the relevant policies and responsibilities.",
    ],
  },
];

export const TRAINING_PLAN_SIGNATORY_NOTE =
  "By signing, apprentice, employer, and provider confirm agreement with the responsibilities in the training plan and the commitment to the apprenticeship programme.";

const STORAGE_KEY = "gta-training-plan-agreement-v1";

function emptySignature(): AgreementSignature {
  return {
    signed: false,
    signedAt: null,
    signedBy: null,
  };
}

export const DEFAULT_TRAINING_PLAN_AGREEMENT: TrainingPlanAgreementState = {
  apprentice: emptySignature(),
  employer: emptySignature(),
  mentor: {
    ...emptySignature(),
    note: "",
  },
};

function isSignature(value: unknown): value is AgreementSignature {
  return Boolean(
    value &&
      typeof value === "object" &&
      "signed" in value &&
      typeof (value as AgreementSignature).signed === "boolean",
  );
}

export function readTrainingPlanAgreement(): TrainingPlanAgreementState {
  if (typeof window === "undefined") return DEFAULT_TRAINING_PLAN_AGREEMENT;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_TRAINING_PLAN_AGREEMENT;

  try {
    const parsed = JSON.parse(raw) as Partial<TrainingPlanAgreementState> & {
      apprentice?: AgreementSignature;
    };
    const apprenticeSig =
      (isSignature(parsed.apprentice) && parsed.apprentice) ||
      (isSignature(parsed.apprentice) && parsed.apprentice) ||
      DEFAULT_TRAINING_PLAN_AGREEMENT.apprentice;
    return {
      apprentice: apprenticeSig,
      employer: isSignature(parsed.employer)
        ? parsed.employer
        : DEFAULT_TRAINING_PLAN_AGREEMENT.employer,
      mentor:
        parsed.mentor &&
        typeof parsed.mentor === "object" &&
        typeof parsed.mentor.note === "string" &&
        isSignature(parsed.mentor)
          ? {
              signed: parsed.mentor.signed,
              signedAt: parsed.mentor.signedAt,
              signedBy: parsed.mentor.signedBy,
              note: parsed.mentor.note,
            }
          : DEFAULT_TRAINING_PLAN_AGREEMENT.mentor,
    };
  } catch {
    return DEFAULT_TRAINING_PLAN_AGREEMENT;
  }
}

function persistTrainingPlanAgreement(
  next: TrainingPlanAgreementState,
): TrainingPlanAgreementState {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

export function useTrainingPlanAgreementState() {
  const [state, setState] = useState<TrainingPlanAgreementState>(
    DEFAULT_TRAINING_PLAN_AGREEMENT,
  );

  useEffect(() => {
    setState(readTrainingPlanAgreement());
  }, []);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key === STORAGE_KEY) {
        setState(readTrainingPlanAgreement());
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const sign = useCallback(
    (
      audience: AgreementAudience,
      signedBy: string,
      extra?: { note?: string },
    ) => {
      setState((prev) => {
        const next: TrainingPlanAgreementState =
          audience === "mentor"
            ? {
                ...prev,
                mentor: {
                  signed: true,
                  signedAt: new Date().toISOString(),
                  signedBy,
                  note: extra?.note?.trim() ?? prev.mentor.note,
                },
              }
            : {
                ...prev,
                [audience]: {
                  signed: true,
                  signedAt: new Date().toISOString(),
                  signedBy,
                },
              };

        return persistTrainingPlanAgreement(next);
      });
    },
    [],
  );

  const setMentorNote = useCallback((note: string) => {
    setState((prev) => {
      const next = {
        ...prev,
        mentor: {
          ...prev.mentor,
          note,
        },
      };
      return persistTrainingPlanAgreement(next);
    });
  }, []);

  const summary = useMemo(
    () => ({
      allSigned: state.apprentice.signed && state.employer.signed && state.mentor.signed,
      apprenticePending: !state.apprentice.signed,
      employerPending: !state.employer.signed,
      mentorPending: !state.mentor.signed,
    }),
    [state],
  );

  return { state, sign, setMentorNote, summary };
}
