import { describe, expect, it } from "vitest";
import { buildEmployerDirectory } from "./employers";

describe("employer directory", () => {
  it("counts each employer once and keeps every site on that row", () => {
    const rows = buildEmployerDirectory({
      today: "2026-11-16",
      employers: [
        { employerId: "GTA-EMP-000002", name: "BCA" },
        { employerId: "GTA-EMP-000001", name: "Adam Bowes Commercials Limited" },
      ],
      sites: [
        { employerId: "GTA-EMP-000002", areaName: "Grimsby", postcode: "DN31 2TG", active: true },
        { employerId: "GTA-EMP-000002", areaName: "Leeds", postcode: "LS1 1AA", active: true },
        { employerId: "GTA-EMP-000001", areaName: "Market Weighton", postcode: "YO43 3GA", active: true },
      ],
      vacancies: [],
      allocations: [],
      reoffers: [],
      activities: [],
      followUps: [],
    });
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.name)).toEqual(["Adam Bowes Commercials Limited", "BCA"]);
    expect(rows[0]).toMatchObject({ site: "Market Weighton", detail: "YO43 3GA", openVacancies: 0, placesAvailable: 0, lastContact: null, nextFollowUp: null, source: null });
    expect(rows[1].site).toBe("Grimsby, Leeds");
    expect(rows[1].detail).toBe("2 sites");
  });

  it("counts open and potential places, and leaves a withdrawn place unavailable", () => {
    const [row] = buildEmployerDirectory({
      today: "2026-11-16",
      employers: [{ employerId: "E1", name: "Northbridge" }],
      sites: [],
      vacancies: [
        { id: "v1", employerId: "E1", status: "open", totalPlaces: 2 },
        { id: "v2", employerId: "E1", status: "potential", totalPlaces: 1 },
        { id: "v3", employerId: "E1", status: "filled", totalPlaces: 1 },
      ],
      allocations: [{ vacancyId: "v1", released: false, releaseReason: null }],
      reoffers: [{ vacancyId: "v1", decision: "pending" }],
      activities: [{ id: "a1", employerId: "E1", actualOn: "2026-11-02" }],
      followUps: [{ activityId: "a1", dueOn: "2026-11-10", completedOn: null }],
    });
    expect(row.openVacancies).toBe(2);
    expect(row.placesAvailable).toBe(1);
    expect(row.lastContact).toBe("2026-11-02");
    expect(row.nextFollowUp).toBe("2026-11-10");
    expect(row.followUpOverdue).toBe(true);
    expect(row.site).toBe("—");
  });
});
