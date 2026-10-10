import { describe, expect, it } from "vitest";
import { serverMutationErrorMessage } from "../apps/web/src/lib/server-mutation-errors";
import { getDictionary } from "../apps/web/src/lib/i18n";

describe("localized server mutation errors", () => {
  it.each(["en", "ru"] as const)(
    "maps stable registration codes without displaying raw English errors (%s)",
    (locale) => {
      const copy = getDictionary(locale).serverRegistration;
      const translations = {
        SERVER_SLUG_TAKEN: copy.slugTaken,
        SERVER_ENDPOINT_TAKEN: copy.endpointTaken,
        FORBIDDEN: copy.organizationForbidden,
        REQUEST_BODY_TOO_LARGE: copy.bodyTooLarge,
        REQUEST_BODY_TIMEOUT: copy.bodyTimedOut,
      };
      for (const [code, expected] of Object.entries(translations)) {
        expect(serverMutationErrorMessage({
          code,
          error: "Raw unlocalized backend error",
        }, translations, copy.createError)).toBe(expected);
      }
    },
  );

  it.each(["en", "ru"] as const)(
    "maps editor conflicts and transport timeouts (%s)",
    (locale) => {
      const copy = getDictionary(locale).serverManagement;
      expect(serverMutationErrorMessage({
        code: "SERVER_METADATA_CONFLICT",
        error: "Stale update",
      }, { SERVER_METADATA_CONFLICT: copy.concurrentEdit }, copy.saveError))
        .toBe(copy.concurrentEdit);
      expect(serverMutationErrorMessage({
        code: "REQUEST_BODY_TIMEOUT",
      }, { REQUEST_BODY_TIMEOUT: copy.bodyTimedOut }, copy.saveError))
        .toBe(copy.bodyTimedOut);
    },
  );

  it("does not trust arbitrary payloads or prototype keys", () => {
    const messages = { FORBIDDEN: "Not allowed" };
    expect(serverMutationErrorMessage(null, messages, "Fallback")).toBe("Fallback");
    expect(serverMutationErrorMessage([], messages, "Fallback")).toBe("Fallback");
    expect(serverMutationErrorMessage({ code: "__proto__" }, messages, "Fallback"))
      .toBe("Fallback");
    expect(serverMutationErrorMessage({ error: "unsafe\nmessage" }, messages, "Fallback"))
      .toBe("Fallback");
    expect(serverMutationErrorMessage({ error: "ordinary error" }, messages, "Fallback"))
      .toBe("ordinary error");
  });

  it("rejects every C0 control character while permitting ordinary multilingual text", () => {
    for (let code = 0; code < 32; code++) {
      expect(serverMutationErrorMessage({ error: `error${String.fromCharCode(code)}message` }, {}, "Fallback"))
        .toBe("Fallback");
    }
    expect(serverMutationErrorMessage({ error: "Сервер недоступен 🌍" }, {}, "Fallback"))
      .toBe("Сервер недоступен 🌍");
  });
});
