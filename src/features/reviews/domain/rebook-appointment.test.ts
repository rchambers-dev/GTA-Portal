import { describe, expect, it } from "vitest";
import { rebookAppointmentArgs } from "./rebook-appointment";

const base = {
  reviewId: "review-1",
  gtaId: "GTA-1",
  missedDate: "2026-11-13",
  date: "2026-11-16",
  method: "in_person",
  arriveMinutes: 650.4,
  leaveMinutes: 680.2,
  orderedGtaIds: ["GTA-2", "GTA-1"],
  backToQueue: false,
};

describe("rebook appointment arguments", () => {
  it("stores an in-person booking as a visit and rounds the times", () => {
    expect(rebookAppointmentArgs(base)).toMatchObject({
      p_method: "in_person",
      p_kind: "visit",
      p_arrive: 650,
      p_leave: 680,
      p_gta_ids: ["GTA-2", "GTA-1"],
      p_back_to_queue: false,
    });
  });

  it("stores Teams as a teams stop, not a visit", () => {
    expect(rebookAppointmentArgs({ ...base, method: "teams" }).p_kind).toBe("teams");
    expect(rebookAppointmentArgs({ ...base, method: "teams" }).p_method).toBe("teams");
  });

  it("stores a phone call as a phone stop with no drive times", () => {
    expect(rebookAppointmentArgs({ ...base, method: "phone" })).toMatchObject({
      p_method: "phone",
      p_kind: "phone",
      p_arrive: null,
      p_leave: null,
      p_gta_ids: [],
      p_date: "2026-11-16",
    });
  });

  it("sends Back To Queue as one call with no new booking", () => {
    expect(rebookAppointmentArgs({ ...base, backToQueue: true })).toEqual({
      p_review_id: "review-1",
      p_gta_id: "GTA-1",
      p_missed_date: "2026-11-13",
      p_date: null,
      p_method: "in_person",
      p_kind: "visit",
      p_arrive: null,
      p_leave: null,
      p_gta_ids: [],
      p_back_to_queue: true,
    });
  });
});
