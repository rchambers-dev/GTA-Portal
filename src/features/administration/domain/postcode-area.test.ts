import { describe, expect, it } from "vitest";
import { areaFromPostcodePlace, isUkPostcode, normaliseUkPostcode } from "./postcode-area";

describe("postcode area", () => {
  it("normalises the same way as the database", () => {
    expect(normaliseUkPostcode("s251aa")).toBe("S25 1AA");
    expect(normaliseUkPostcode("  dn2   4sf ")).toBe("DN2 4SF");
    expect(normaliseUkPostcode("S1 1AA")).toBe("S1 1AA");
    expect(isUkPostcode(normaliseUkPostcode("s25 2ay"))).toBe(true);
    expect(isUkPostcode("S25")).toBe(false);
    expect(isUkPostcode("NOT A POSTCODE")).toBe(false);
  });

  it("prefers a tidied parish, with the ward when the parish is a saint dedication", () => {
    expect(
      areaFromPostcodePlace({
        parish: "Dinnington St. John's",
        admin_ward: "Dinnington",
        admin_district: "Rotherham",
      }),
    ).toBe("Dinnington");

    expect(
      areaFromPostcodePlace({
        parish: "Sheffield, unparished area",
        admin_ward: "City",
        admin_district: "Sheffield",
      }),
    ).toBe("Sheffield");

    expect(
      areaFromPostcodePlace({
        parish: "Barnby Dun with Kirk Sandall",
        admin_ward: "Stainforth & Barnby Dun",
        admin_district: "Doncaster",
      }),
    ).toBe("Barnby Dun with Kirk Sandall");

    expect(
      areaFromPostcodePlace({
        parish: null,
        admin_district: "Leeds",
      }),
    ).toBe("Leeds");
  });
});
