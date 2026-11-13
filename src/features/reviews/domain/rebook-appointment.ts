export type RebookAppointmentInput = {
  reviewId: string;
  gtaId: string;
  missedDate: string;
  date: string | null;
  method: string;
  arriveMinutes: number | null;
  leaveMinutes: number | null;
  orderedGtaIds: string[];
  backToQueue: boolean;
};

export type RebookAppointmentArgs = {
  p_review_id: string;
  p_gta_id: string;
  p_missed_date: string;
  p_date: string | null;
  p_method: "in_person" | "teams" | "phone";
  p_kind: "visit" | "teams" | "phone";
  p_arrive: number | null;
  p_leave: number | null;
  p_gta_ids: string[];
  p_back_to_queue: boolean;
};

/** Arguments for the single rebook_review_appointment call. Kind follows the booking method. */
export function rebookAppointmentArgs(input: RebookAppointmentInput): RebookAppointmentArgs {
  const method = input.method === "teams" || input.method === "phone" ? input.method : "in_person";
  const kind = method === "teams" ? "teams" : method === "phone" ? "phone" : "visit";
  if (input.backToQueue) {
    return {
      p_review_id: input.reviewId,
      p_gta_id: input.gtaId,
      p_missed_date: input.missedDate,
      p_date: null,
      p_method: "in_person",
      p_kind: "visit",
      p_arrive: null,
      p_leave: null,
      p_gta_ids: [],
      p_back_to_queue: true,
    };
  }
  const arrive = method === "phone" || input.arriveMinutes == null ? null : Math.round(input.arriveMinutes);
  const leave = method === "phone" || input.leaveMinutes == null ? null : Math.round(input.leaveMinutes);
  const ids = method === "phone" ? [] : [...new Set(input.orderedGtaIds.includes(input.gtaId) ? input.orderedGtaIds : [...input.orderedGtaIds, input.gtaId])];
  return {
    p_review_id: input.reviewId,
    p_gta_id: input.gtaId,
    p_missed_date: input.missedDate,
    p_date: input.date,
    p_method: method,
    p_kind: kind,
    p_arrive: arrive,
    p_leave: leave,
    p_gta_ids: ids,
    p_back_to_queue: false,
  };
}
