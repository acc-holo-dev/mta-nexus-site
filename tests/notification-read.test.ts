import { describe, expect, it } from "vitest";
import {
  NOTIFICATION_INBOX_SELECTION_LIMIT,
  notificationInboxCommandSchema,
} from "../site/src/lib/notification-inbox-contract";
import { parseNotificationReadTarget } from "../site/src/lib/notification-read";

describe("notification read target", () => {
  it.each(["", "{}", " { } "])(
    "fails closed for legacy bodies without the actor precondition %j",
    (body) => {
      expect(parseNotificationReadTarget(body)).toBeNull();
    },
  );

  it("normalizes a single id without changing scope", () => {
    expect(parseNotificationReadTarget('{"id":"  not_123  ","expectedActorId":"usr_1"}')).toEqual({
      scope: "single",
      id: "not_123",
      expectedActorId: "usr_1",
    });
  });
  it("accepts an actor-bound account-wide action", () => {
    expect(parseNotificationReadTarget('{"expectedActorId":"usr_1"}')).toEqual({
      scope: "all",
      expectedActorId: "usr_1",
    });
  });

  it.each([
    "null",
    "[]",
    "not-json",
    '{"id":null}',
    '{"id":""}',
    '{"id":"   "}',
    '{"id":123}',
    '{"unexpected":true}',
    '{"id":"not_123","unexpected":true}',
    '{"__proto__":{}}',
    JSON.stringify({ id: "x".repeat(129) }),
    " ".repeat(1025),
  ])("rejects malformed and ambiguous bulk action %j", (body) => {
    expect(parseNotificationReadTarget(body)).toBeNull();
  });

  it("keeps page selection commands distinct from account-wide all-read and refuses batches over 25", () => {
    expect(NOTIFICATION_INBOX_SELECTION_LIMIT).toBe(25);
    expect(
      notificationInboxCommandSchema.safeParse({
        isRead: true,
        items: Array.from({ length: 25 }, (_, n) => ({
          id: String(n),
          expectedIsRead: false,
        })),
      }).success,
    ).toBe(true);
    expect(
      notificationInboxCommandSchema.safeParse({
        isRead: true,
        items: Array.from({ length: 26 }, (_, n) => ({
          id: String(n),
          expectedIsRead: false,
        })),
      }).success,
    ).toBe(false);
    expect(
      notificationInboxCommandSchema.safeParse({
        isRead: true,
        scope: "all",
        items: [{ id: "owned", expectedIsRead: false }],
      }).success,
    ).toBe(false);
  });
});
