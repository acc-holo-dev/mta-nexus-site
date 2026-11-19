import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { productsApiCopy } from "../../src/features/resources/products-api-copy";

/** Wave 93: /api/products GET/POST errors use bilingual productsApiCopy. */
describe("products API copy honesty surface", () => {
  it("keeps RU/EN keys and wires the products route through nexus_locale", () => {
    const en = productsApiCopy("en");
    const ru = productsApiCopy("ru");
    expect(Object.keys(ru)).toEqual(Object.keys(en));
    expect(en.catalogUnavailable).toContain("temporarily unavailable");
    expect(ru.catalogUnavailable).toContain("недоступен");
    expect(en.paidDisabled).toContain("Paid resources are disabled");
    expect(ru.createFailed).toContain("создать ресурс");

    const route = readFileSync(
      resolve(process.cwd(), "site/src/app/api/products/route.ts"),
      "utf8",
    );
    expect(route).toContain("productsApiCopy");
    expect(route).toContain("resolveLocale");
    expect(route).toContain("nexus_locale");
    expect(route).toContain("copy.catalogUnavailable");
    expect(route).toContain("copy.authenticationRequired");
    expect(route).toContain("copy.actorRequired");
    expect(route).toContain("copy.actorChanged");
    expect(route).toContain("copy.creationLimitExceeded");
    expect(route).toContain("copy.invalidDetails");
    expect(route).toContain("copy.paidDisabled");
    expect(route).toContain("copy.slugExists");
    expect(route).toContain("copy.createFailed");
    expect(route).not.toContain('"Resource catalog is temporarily unavailable"');
    expect(route).not.toContain('"Authentication required"');
    expect(route).not.toContain('"Actor precondition required"');
    expect(route).not.toContain('"Actor changed"');
    expect(route).not.toContain('"Resource creation limit exceeded"');
    expect(route).not.toContain('"Invalid resource details"');
    expect(route).not.toContain(
      '"Paid resources are disabled until a payment provider is configured"',
    );
    expect(route).not.toContain('"A resource with this slug already exists"');
    expect(route).not.toContain('"Could not create resource"');
  });
});
