import { createSupportMessageSchema, updateSupportCaseStatusSchema } from "@nexus/validation";
import { expect, it } from "vitest";
import { formatNotification } from "../../apps/web/src/lib/notification-copy";
import {
  confirmSupportStatusChanged,
  parseSupportThread,
} from "../../apps/web/src/lib/support-response";
import {
  publicationSupportHref,
  supportActivitySchema,
  supportHref,
  supportQuery,
} from "../../apps/web/src/lib/support-workspace-contract";
import {
  supportWorkspaceCopy,
  supportWorkspaceError,
} from "../../apps/web/src/lib/support-workspace-copy";

const id = `sup_${"a".repeat(24)}`,
  time = "2026-10-11T00:00:00.000Z";
it("normalizes supported search filters and preserves them in page links", () => {
  const filters = supportQuery(
    new URLSearchParams("q=%20Access%20&status=resolved&category=account&page=2"),
  );
  if (!filters) throw new Error("Valid filters rejected");
  expect(filters).toEqual({ q: "Access", status: "resolved", category: "account", page: 2 });
  expect(publicationSupportHref("  Gate  will  not  open  ")).toBe(
    "/support?draft=publication&subject=Gate+will+not+open",
  );
  expect(publicationSupportHref("No")).toBe("/support");
  expect(supportHref("/support", filters, 3)).toBe(
    "/support?page=3&q=Access&status=resolved&category=account",
  );
  expect(supportQuery(new URLSearchParams("status=&category="))).toEqual({ page: 1, q: "" });
  expect(supportQuery(new URLSearchParams("scope=staff&q=Access"), true)?.q).toBe("Access");
  expect(
    supportQuery(new URLSearchParams("draft=publication&subject=%20Broken%20gate%20")),
  ).toEqual({
    page: 1,
    q: "",
    draft: "publication",
    subject: "Broken gate",
  });
  expect(supportQuery(new URLSearchParams("draft=ad&subject=Broken%20gate"))).toBeNull();
  expect(supportQuery(new URLSearchParams("subject=tiny"))).toBeNull();
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
    const legacy = formatNotification(
      { title: "Support case activity", message: `Support case ${id}: reply.`, data: undefined },
      copy,
      locale,
    );
    expect(legacy.message).not.toContain(id);
    expect(legacy.message).not.toContain("Private subject");
    expect(
      locale === "ru" ? legacy.message.includes("Поддержка") : legacy.message.includes("Support"),
    ).toBe(true);
    const structured = formatNotification(
      {
        title: "Support case activity",
        message: "stored",
        data: {
          kind: "support_requester",
          event: "reply",
          caseId: id,
          subject: "Private subject",
        },
      },
      copy,
      locale,
    );
    expect(structured.message).toContain("Private subject");
    expect(structured.message).not.toContain(id);
  },
);
