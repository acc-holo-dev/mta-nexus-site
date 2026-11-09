import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { formatNotification } from "../../apps/web/src/lib/notification-copy";

const reviewCopy = { approved: "", rejected: "", version: "", notes: "" };

it("deep-links author removal notices to the discussion permalink", () => {
  const notice = readFileSync(
    resolve("packages/db/src/repositories/discussion-moderation-notice.ts"),
    "utf8",
  );
  expect(notice).toContain("function authorDiscussionHref(commentId: string)");
  expect(notice).toMatch(
    /return `\/workspace\/discussions\/\$\{encodeURIComponent\(commentId\)\}`;/u,
  );
  expect(notice).toContain("link: authorDiscussionHref(input.commentId)");
  expect(notice).not.toContain("#discussion");
  expect(notice).not.toMatch(/link:\s*"\/workspace\/discussions"/u);
  const management = readFileSync(
    resolve("packages/db/src/repositories/discussion-management.ts"),
    "utf8",
  );
  expect(management).toMatch(/discussionModerationNotice\(tx, \{[\s\S]*commentId: current\.id,/u);
  expect(management).not.toContain("available:");
});

it("exposes staff comment report moderationHref to the admin community discussion", () => {
  const source = readFileSync(
    resolve("packages/db/src/repositories/admin-report-targets.ts"),
    "utf8",
  );
  expect(source).toMatch(
    /moderationHref: row\.contentId\s*\?\s*`\/admin\/community\/\$\{encodeURIComponent\(row\.contentId\)\}\/discussion\/\$\{encodeURIComponent\(row\.id\)\}`/u,
  );
  expect(source).toMatch(
    /href: row\.slug \? `\/articles\/\$\{encodeURIComponent\(row\.slug\)\}` : null/u,
  );
});

it.each(["en", "ru"] as const)(
  "localizes discussion removal copy with a workspace destination cue in %s",
  (locale) => {
    const result = formatNotification(
      {
        title: "Discussion moderation",
        message: "Comment cmt_a: removed.",
        data: undefined,
      },
      reviewCopy,
      locale,
    );
    expect(result.title).toBe(locale === "ru" ? "Модерация обсуждения" : "Discussion moderation");
    expect(result.message.toLowerCase()).toContain(locale === "ru" ? "рабоч" : "workspace");
    expect(result.message).not.toContain("cmt_a");
  },
);
