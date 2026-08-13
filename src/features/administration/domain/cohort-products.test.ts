import { describe, expect, it } from "vitest";
import {
  defaultProductForStandard,
  normalizeDeliverySpine,
  productsForStandard,
} from "./cohort-products";

describe("cohort products after Groups retirement", () => {
  it("normalizes any stored spine value to blocks", () => {
    expect(normalizeDeliverySpine("groups")).toBe("blocks");
    expect(normalizeDeliverySpine(null)).toBe("blocks");
    expect(normalizeDeliverySpine("blocks")).toBe("blocks");
  });

  it("defaults Autocare to controlled Blocks, not Groups", () => {
    const product = defaultProductForStandard("ST0499");
    expect(product?.deliverySpine).toBe("blocks");
    expect(product?.standardVersion).toBe("1.3");
  });

  it("does not offer a Groups product for Autocare", () => {
    const products = productsForStandard("ST0499", { includeFinishers: true });
    expect(products.every((p) => p.deliverySpine === "blocks")).toBe(true);
  });
});
