import { expect, it } from "vitest";
import { formatNotification } from "../apps/web/src/lib/notification-copy";

const reviewCopy = { approved: "", rejected: "", version: "", notes: "" };

it.each(["asked", "answered", "resolved", "removed"] as const)(
  "localizes resource Q&A %s notices in RU without changing stored English templates",
  (event) => {
    const en = formatNotification(
      {
        title: "New resource question",
        message: "Someone asked about Physics Pack.",
        data: {
          kind: "resource_qa",
          event,
          productId: "prd_a",
          threadId: "rqt_a",
          answerId: null,
        },
      },
      reviewCopy,
      "en",
    );
    const ru = formatNotification(
      {
        title: "New resource question",
        message: "Someone asked about Physics Pack.",
        data: {
          kind: "resource_qa",
          event,
          productId: "prd_a",
          threadId: "rqt_a",
          answerId: null,
        },
      },
      reviewCopy,
      "ru",
    );
    expect(en.title.length).toBeGreaterThan(0);
    expect(ru.title).not.toEqual(en.title);
    expect(ru.message).not.toEqual(en.message);
  },
);
