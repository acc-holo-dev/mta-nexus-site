import { expect, it } from "vitest";
import { createSupportMessageSchema, updateSupportCaseStatusSchema } from "@nexus/validation";
import {
  supportQuery,
  supportHref,
  supportActivitySchema,
} from "../apps/web/src/lib/support-workspace-contract";
import {
  supportWorkspaceCopy,
  supportWorkspaceError,
} from "../apps/web/src/lib/support-workspace-copy";
import { formatNotification } from "../apps/web/src/lib/notification-copy";
import {
  confirmSupportStatusChanged,
  parseSupportThread,
} from "../apps/web/src/lib/support-response";
const id = `sup_${"a".repeat(24)}`,
  time = "2026-10-11T00:00:00.000Z";
it("normalizes supported search filters and preserves them in page links", () => {
  const filters = supportQuery(
    new URLSearchParams("q=%20Access%20&status=resolved&category=account&page=2"),
  );
  if (!filters) throw new Error("Valid filters rejected");
  expect(filters).toEqual({ q: "Access", status: "resolved", category: "account", page: 2 });
  expect(supportHref("/support", filters, 3)).toBe(
    "/support?page=3&q=Access&status=resolved&category=account",
  );
  expect(supportQuery(new URLSearchParams("status=&category="))).toEqual({ page: 1, q: "" });
  expect(supportQuery(new URLSearchParams("scope=staff&q=Access"), true)?.q).toBe("Access");
});
it.each([
  "page=0",
  "page=10000",
  "page=1&page=2",
  "status=unknown",
  "category=anything",
  "requesterId=victim",
  "scope=own",
  "scope=staff&scope=staff",
  "scope=staff",
  `q=${"x".repeat(121)}`,
])("refuses forged, duplicate or unbounded filter %s", (query) => {
  expect(supportQuery(new URLSearchParams(query), query !== "scope=staff")).toBeNull();
});
it("accepts optional valid revisions for legacy staff clients but rejects identity injection", () => {
  for (const input of [
    { message: "Reply", expectedStatus: "open", expectedUpdatedAt: time },
    { status: "resolved", expectedStatus: "open", expectedUpdatedAt: time },
  ]) {
    const schema = "message" in input ? createSupportMessageSchema : updateSupportCaseStatusSchema;
    expect(schema.safeParse(input).success).toBe(true);
    expect(schema.safeParse({ ...input, expectedUpdatedAt: "invalid" }).success).toBe(false);
    expect(schema.safeParse({ ...input, actorId: "staff" }).success).toBe(false);
  }
});
it("only confirms revision-aware status writes after a strictly newer saved version", () => {
  const payload = {
    success: true,
    supportCase: {
      id,
      category: "account",
      subject: "Access",
      status: "resolved",
      updatedAt: "2026-10-11T00:00:00.001Z",
    },
  };
  expect(confirmSupportStatusChanged(200, payload, id, "resolved", time)).toBeTruthy();
  expect(
    confirmSupportStatusChanged(
      200,
      { ...payload, supportCase: { ...payload.supportCase, updatedAt: time } },
      id,
      "resolved",
      time,
    ),
  ).toBeNull();
  expect(
    confirmSupportStatusChanged(
      200,
      { ...payload, supportCase: { ...payload.supportCase, updatedAt: undefined } },
      id,
      "resolved",
      time,
    ),
  ).toBeNull();
});
it("parses actual server capabilities and refuses malformed capability values", () => {
  const payload = {
    supportCase: { id, category: "account", subject: "Access", status: "open", updatedAt: time },
    messages: [],
    messagePage: 1,
    messageTotalPages: 1,
    messageTotal: 0,
    staff: false,
    requester: true,
  };
  expect(parseSupportThread(payload, id)).toMatchObject({ staff: false, requester: true });
  expect(parseSupportThread({ ...payload, staff: "true" }, id)).toBeNull();
});
it("bounds private status history and excludes arbitrary audit fields", () => {
  const item = { id: "audit", from: "open", to: "resolved", by: "staff", createdAt: time };
  expect(supportActivitySchema.safeParse({ items: [item], nextCursor: null }).success).toBe(true);
  expect(
    supportActivitySchema.safeParse({
      items: [{ ...item, details: { message: "secret" } }],
      nextCursor: null,
    }).success,
  ).toBe(false);
  expect(
    supportActivitySchema.safeParse({
      items: Array.from({ length: 21 }, () => item),
      nextCursor: null,
    }).success,
  ).toBe(false);
});
it.each(["ru", "en"] as const)(
  "localizes saved, uncertain and role errors plus bounded notices in %s",
  (locale) => {
    expect(supportWorkspaceCopy(locale).uncertain).toBeTruthy();
    expect(supportWorkspaceError(locale, "SUPPORT_ACTIVITY_EXPIRED")).toBe(
      supportWorkspaceCopy(locale).historyExpired,
    );
    const copy = { approved: "", rejected: "", version: "", notes: "" };
    const notice = formatNotification(
      { title: "Support case activity", message: `Support case ${id}: reply.`, data: undefined },
      copy,
      locale,
    );
    expect(notice.message).not.toContain(id);
    expect(notice.message).not.toContain("Private subject");
    expect(
      locale === "ru" ? notice.message.includes("Поддержка") : notice.message.includes("Support"),
    ).toBe(true);
  },
);
