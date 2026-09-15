import { describe, it, expect } from "vitest";
import {
  createServerSchema,
  createProductSchema,
  checkoutSchema,
} from "@nexus/validation";

describe("Validation Schemas", () => {
  it("should validate server creation data", () => {
    const validServer = {
      name: "San Andreas Touge Club",
      slug: "sa-touge-club",
      ipAddress: "127.0.0.1",
      port: 22003,
      httpPort: 22005,
      maxPlayers: 128,
    };

    const result = createServerSchema.safeParse(validServer);
    expect(result.success).toBe(true);
  });

  it("should reject product with negative price", () => {
    const invalidProduct = {
      title: "Broken Product",
      slug: "broken-product",
      description: "Invalid negative price resource",
      type: "script",
      price: -500,
      licenseModel: "single_server",
    };

    const result = createProductSchema.safeParse(invalidProduct);
    expect(result.success).toBe(false);
  });

  it("should require at least one item for checkout", () => {
    const emptyCheckout = {
      items: [],
      paymentProvider: "mock",
    };

    const result = checkoutSchema.safeParse(emptyCheckout);
    expect(result.success).toBe(false);
  });
});
