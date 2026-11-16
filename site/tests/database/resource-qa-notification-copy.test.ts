import { expect, it } from "vitest";
import { formatNotification } from "../../src/lib/notification-copy";

const reviewCopy = { approved: "", rejected: "", version: "", notes: "" };

it.each(["asked", "answered", "resolved", "removed"] as const)(
  "localizes resource Q&A %s notices with the product title in RU and EN",
  (event) => {
    const en = formatNotification(
      {
        title: "New resource question",
        message: "Someone asked about Physics Pack.",
        data: {
          kind: "resource_qa",
          event,
          productId: "prd_a",
          productTitle: "Physics Pack",
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
          productTitle: "Physics Pack",
          threadId: "rqt_a",
          answerId: null,
        },
      },
      reviewCopy,
      "ru",
    );
    expect(en.title.length).toBeGreaterThan(0);
    expect(en.message).toContain("Physics Pack");
    expect(ru.title).not.toEqual(en.title);
    expect(ru.message).toContain("Physics Pack");
    expect(ru.message).not.toEqual(en.message);
  },
);
