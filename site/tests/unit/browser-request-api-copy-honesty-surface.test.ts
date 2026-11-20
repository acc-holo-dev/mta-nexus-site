import { expect, it } from "vitest";
import { browserRequestApiCopy } from "../../src/lib/http/browser-request-api-copy";

it("keeps browser CSRF rejection envelopes bilingual without changing codes", () => {
  expect(browserRequestApiCopy("en").originNotAllowed).toBe("Request origin is not allowed");
  expect(browserRequestApiCopy("en").configurationUnavailable).toBe(
    "Request security configuration unavailable",
  );
  expect(browserRequestApiCopy("ru").originNotAllowed).toBe("Источник запроса не разрешён");
  expect(browserRequestApiCopy("ru").configurationUnavailable).toBe(
    "Конфигурация безопасности запроса недоступна",
  );
});
