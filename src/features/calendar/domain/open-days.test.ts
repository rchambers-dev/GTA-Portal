import { describe, expect, it } from "vitest";
import {
  DONCASTER_WEEKDAYS,
  SHEFFIELD_WEEKDAYS,
  isOpenDay,
  nextOpenDay,
  previousOpenDay,
  rollPlannedOn,
  weekIsExcluded,
  weekOpenDayCount,
  type ClosureSpan,
} from "./open-days";

const closures: ClosureSpan[] = [
  { name: "Christmas shutdown", startsOn: "2026-12-24", endsOn: "2027-01-04" },
  { name: "Easter shutdown", startsOn: "2027-03-29", endsOn: "2027-04-02" },
  { name: "Early May", startsOn: "2027-05-03", endsOn: "2027-05-03" },
  { name: "Spring half term", startsOn: "2027-05-31", endsOn: "2027-06-04" },
  { name: "Summer shutdown", startsOn: "2027-08-23", endsOn: "2027-08-27" },
  { name: "Summer bank holiday", startsOn: "2027-08-30", endsOn: "2027-08-30" },
  { name: "Christmas Eve", startsOn: "2027-12-24", endsOn: "2027-12-24" },
  { name: "Christmas shutdown", startsOn: "2027-12-27", endsOn: "2027-12-31" },
  { name: "New Year", startsOn: "2028-01-03", endsOn: "2028-01-03" },
];

describe("open days", () => {
  it("treats Good Friday 26 Mar 2027 as open because it is not a closure", () => {
    expect(isOpenDay("2027-03-26", closures)).toBe(true);
  });

  it("moves Monday 4 Jan 2027 to Tuesday 5 Jan in the same open week", () => {
    expect(rollPlannedOn("2027-01-04", closures)).toBe("2027-01-05");
    expect(weekIsExcluded("2027-01-04", closures)).toBe(false);
  });

  it("treats the week of 28 Dec 2026 as excluded and steps back to 23 Dec", () => {
    expect(weekOpenDayCount("2026-12-28", closures, DONCASTER_WEEKDAYS)).toBe(0);
    expect(weekIsExcluded("2026-12-28", closures)).toBe(true);
    expect(rollPlannedOn("2026-12-30", closures)).toBe("2026-12-23");
  });

  it("keeps a normal Tuesday and walks to the previous and next open day", () => {
    expect(isOpenDay("2027-01-05", closures)).toBe(true);
    expect(previousOpenDay("2027-01-05", closures)).toBe("2026-12-23");
    expect(nextOpenDay("2027-01-04", closures)).toBe("2027-01-05");
  });

  it("counts only Monday and Tuesday as open at Sheffield", () => {
    expect(weekOpenDayCount("2027-01-04", closures, SHEFFIELD_WEEKDAYS)).toBe(1);
    expect(weekIsExcluded("2027-01-04", closures, SHEFFIELD_WEEKDAYS)).toBe(true);
    expect(isOpenDay("2027-01-06", closures, SHEFFIELD_WEEKDAYS)).toBe(false);
  });
});
