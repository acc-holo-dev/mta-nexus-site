import { describe, expect, it } from "vitest";
import { parseNotificationReadTarget } from "../apps/web/src/lib/notification-read";

describe("notification read target", () => {
  it.each(["", "{}", " { } "])("accepts explicit bulk request %j", (body) => {
    expect(parseNotificationReadTarget(body)).toEqual({ scope: "all" });
  });

  it("normalizes a single id without changing scope", () => {
    expect(parseNotificationReadTarget('{"id":"  not_123  "}')).toEqual({
      scope: "single", id: "not_123",
    });
  });

  it.each([
    "null", "[]", "not-json", '{"id":null}', '{"id":""}',
    '{"id":"   "}', '{"id":123}', '{"unexpected":true}',
    '{"id":"not_123","unexpected":true}', '{"__proto__":{}}',
    JSON.stringify({ id: "x".repeat(129) }),
    " ".repeat(1025),
  ])("rejects malformed and ambiguous bulk action %j", (body) => {
    expect(parseNotificationReadTarget(body)).toBeNull();
  });
});
