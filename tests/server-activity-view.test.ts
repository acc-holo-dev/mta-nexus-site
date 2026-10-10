import { expect, it } from "vitest";
import {
  SERVER_ACTIVITY_ACTIONS,
  SERVER_ACTIVITY_FIELDS,
  serverActivityCursor,
} from "@nexus/domain";
import {
  getServerActivityCopy,
  parseServerActivityCursor,
  serverActivityHref,
} from "../apps/web/src/lib/server-activity-view";

it.each([undefined, null, [], ["aud_1"], "", " ", "a/b", "<script>", "a".repeat(129), 123])(
  "rejects invalid or ambiguous URL cursor %j",
  (value) => {
    expect(serverActivityCursor(value)).toBeUndefined();
    expect(parseServerActivityCursor({ before: value as string })).toBeUndefined();
  },
);
it("accepts an opaque audit ID without trimming or interpreting SQL fragments", () => {
  expect(serverActivityCursor("aud_ABC-123")).toBe("aud_ABC-123");
  expect(parseServerActivityCursor({ before: "aud_ABC-123", limit: "50000" })).toBe("aud_ABC-123");
  expect(serverActivityCursor(" aud_1 ")).toBeUndefined();
});
it("encodes path and query data without allowing URL structure injection", () => {
  expect(serverActivityHref("a/b?x", "aud_1")).toBe(
    "/workspace/servers/a%2Fb%3Fx/activity?before=aud_1",
  );
  expect(serverActivityHref("srv_1", null)).toBe("/workspace/servers/srv_1/activity");
});
it.each(["en", "ru"] as const)("covers every allowed action and changed field in %s", (locale) => {
  const copy = getServerActivityCopy(locale);
  for (const action of SERVER_ACTIVITY_ACTIONS) expect(copy.actions[action]).toBeTruthy();
  for (const field of SERVER_ACTIVITY_FIELDS) expect(copy.fieldNames[field]).toBeTruthy();
  expect(copy.title).toBe(locale === "ru" ? "История сервера" : "Server activity");
});
