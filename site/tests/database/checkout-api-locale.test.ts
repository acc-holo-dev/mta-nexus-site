import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { POST } from "../../src/app/api/checkout/route";
import { checkoutApiCopy } from "../../src/features/commerce/checkout-api-copy";
import {
  browserMutationHeaders,
  stubBrowserMutationOrigin,
} from "../helpers/browser-mutation-headers";

function postRequest(locale: "en" | "ru") {
  return new NextRequest("https://nexus.test/api/checkout", {
    method: "POST",
    headers: {
      ...browserMutationHeaders(),
      cookie: `nexus_locale=${locale}`,
      "content-type": "application/json",
    },
    body: "{}",
  });
}

describe("checkout API locale envelope", () => {
  it.each(["en", "ru"] as const)(
    "returns bilingual CHECKOUT_DISABLED from nexus_locale=%s",
    async (locale) => {
      stubBrowserMutationOrigin();
      const response = await POST(postRequest(locale));
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({
        code: "CHECKOUT_DISABLED",
        error: checkoutApiCopy(locale).disabled,
      });
    },
  );
});
