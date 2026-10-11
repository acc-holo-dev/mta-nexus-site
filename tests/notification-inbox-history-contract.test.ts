import { describe, expect, it } from "vitest";
import {
  confirmedNotificationInboxCommand,
  INBOX_CATEGORIES,
  notificationInboxCommandSchema,
  notificationInboxHref,
  notificationInboxPageSchema,
  parseNotificationInboxQuery,
} from "../apps/web/src/lib/notification-inbox-contract";

const point = {
  id: "notification",
  createdAt: "2026-10-11T00:00:00.123456Z",
  context: "a".repeat(64),
  direction: "older",
  version: 1,
};
describe("notification inbox navigation and commands", () => {
  it("normalizes a query and round trips a filter-bound exact cursor", () => {
    const input = parseNotificationInboxQuery(
      new URLSearchParams({
        q: "  %_\\  ",
        state: "unread",
        category: "content",
        cursor: JSON.stringify(point),
      }),
    );
    expect(input).toMatchObject({
      query: "%_\\",
      state: "unread",
      category: "content",
      cursor: point,
    });
    if (!input) throw Error("Expected parsed query");
    const href = notificationInboxHref("/notifications", input, JSON.stringify(point));
    expect(parseNotificationInboxQuery(new URL(href, "https://nexus.test").searchParams)).toEqual(
      input,
    );
    expect(notificationInboxHref("/notifications", input)).not.toContain("cursor=");
  });
  it.each(INBOX_CATEGORIES)("accepts category %s", (category) =>
    expect(parseNotificationInboxQuery(new URLSearchParams({ category }))?.category).toBe(category),
  );
  it.each([
    "q=x&q=y",
    "category=other",
    "state=unknown",
    "offset=20",
    "limit=100",
    "q=%00",
    "q=%7F",
    `q=${"x".repeat(101)}`,
    "cursor=null",
    "cursor=%7B%7D",
  ])("rejects ambiguous or unsupported filters %s", (query) =>
    expect(parseNotificationInboxQuery(new URLSearchParams(query))).toBeNull(),
  );
  it.each([
    { ...point, version: 2 },
    { ...point, extra: true },
    { ...point, direction: "sideways" },
    { ...point, createdAt: "2026-02-30T00:00:00.123456Z" },
    { ...point, createdAt: "2026-10-11T00:00:00.123Z" },
    { ...point, id: "x\n" },
    { ...point, context: "x" },
  ])("rejects malformed cursor %j", (cursor) =>
    expect(
      parseNotificationInboxQuery(new URLSearchParams({ cursor: JSON.stringify(cursor) })),
    ).toBeNull(),
  );
  const command = {
    isRead: false,
    items: [
      { id: "one", expectedIsRead: true },
      { id: "two", expectedIsRead: false },
    ],
  };
  it("requires explicit state and a unique bounded selection with observed state", () => {
    expect(notificationInboxCommandSchema.safeParse(command).success).toBe(true);
    expect(
      notificationInboxCommandSchema.safeParse({
        isRead: true,
        items: Array.from({ length: 25 }, (_, n) => ({ id: String(n), expectedIsRead: false })),
      }).success,
    ).toBe(true);
    for (const value of [
      null,
      {},
      { isRead: true, items: [] },
      { ...command, scope: "all" },
      { ...command, items: [command.items[0], command.items[0]] },
      { isRead: "true", items: command.items },
      { ...command, items: [{ id: "one" }] },
      {
        ...command,
        items: Array.from({ length: 26 }, (_, n) => ({ id: String(n), expectedIsRead: false })),
      },
    ])
      expect(notificationInboxCommandSchema.safeParse(value).success).toBe(false);
  });
  it("acknowledges only the exact selection and desired state", () => {
    expect(confirmedNotificationInboxCommand({ isRead: false, ids: ["two", "one"] }, command)).toBe(
      true,
    );
    for (const ack of [
      { isRead: true, ids: ["two", "one"] },
      { isRead: false, ids: ["one"] },
      { isRead: false, ids: ["one", "one"] },
      { isRead: false, ids: ["one", "foreign"] },
      { isRead: false, ids: ["one", "two"], recipientId: "secret" },
    ])
      expect(confirmedNotificationInboxCommand(ack, command)).toBe(false);
  });
  it("does not accept invalid dates or raw private payloads in refreshed reports", () => {
    const item = {
      id: "one",
      title: "One",
      message: "Message",
      category: "system",
      link: null,
      isRead: false,
      createdAt: point.createdAt,
      truncated: false,
    };
    const page = { items: [item], unreadCount: 1, olderCursor: null, newerCursor: null };
    expect(notificationInboxPageSchema.safeParse(page).success).toBe(true);
    expect(
      notificationInboxPageSchema.safeParse({ ...page, items: [{ ...item, createdAt: "bad" }] })
        .success,
    ).toBe(false);
    expect(
      notificationInboxPageSchema.safeParse({
        ...page,
        items: [{ ...item, recipientId: "private" }],
      }).success,
    ).toBe(false);
  });
});
