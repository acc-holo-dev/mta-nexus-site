import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createNotificationInboxHistoryQueryDbMock } = await import(
    "./helpers/notification-inbox-history-query-harness"
  );
  return createNotificationInboxHistoryQueryDbMock();
});

import { NotificationRepository } from "../packages/db/src/repositories/notifications";
import {
  installNotificationInboxHistoryQueryHooks,
  notificationInboxHistoryQueryState as state,
} from "./helpers/notification-inbox-history-query-harness";

const repo = new NotificationRepository();

installNotificationInboxHistoryQueryHooks();

it("locks all owned selections in stable order, checks observed state and updates only the recipient", async () => {
  state.rows = [
    [
      ["a", false],
      ["z", true],
    ],
    [["a"], ["z"]],
  ];
  expect(
    await repo.setInboxReadState("actor", {
      isRead: false,
      items: [
        { id: "z", expectedIsRead: true },
        { id: "a", expectedIsRead: false },
      ],
    }),
  ).toEqual({ isRead: false, ids: ["a", "z"] });
  expect(state.queries[0].params).toEqual(["actor", "a", "z"]);
  expect(state.queries[0].sql).toContain('order by "notifications"."id" asc for update');
  expect(state.queries[1].params).toEqual([false, "actor", "a", "z"]);
});

it.each([
  { owned: [["owned", false]] },
  {
    owned: [
      ["owned", true],
      ["other", false],
    ],
  },
])(
  "refuses a partially owned or concurrently changed selection without a write",
  async ({ owned }) => {
    state.rows = [owned];
    await expect(
      repo.setInboxReadState("actor", {
        isRead: true,
        items: [
          { id: "owned", expectedIsRead: false },
          { id: "other", expectedIsRead: false },
        ],
      }),
    ).rejects.toMatchObject({
      code: owned.length === 1 ? "NOT_FOUND" : "NOTIFICATION_STATE_CHANGED",
    });
    expect(state.queries).toHaveLength(1);
  },
);

it.each(
  [
    [],
    Array.from({ length: 26 }, (_, n) => ({ id: String(n), expectedIsRead: false })),
    [
      { id: "same", expectedIsRead: false },
      { id: "same", expectedIsRead: false },
    ],
  ].map((items) => ({ items })),
)("refuses unsafe selections at the storage boundary", async ({ items }) => {
  await expect(repo.setInboxReadState("actor", { isRead: true, items })).rejects.toMatchObject({
    code: "VALIDATION_ERROR",
  });
  expect(state.queries).toHaveLength(0);
});
