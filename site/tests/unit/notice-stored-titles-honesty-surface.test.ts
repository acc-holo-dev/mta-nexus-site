import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { noticeStoredMessages, noticeStoredTitles } from "@nexus/domain";
import { expect, it } from "vitest";
import { canonicalNoticeTitle } from "../../src/features/notifications/notification-copy";

it("keeps bilingual slash titles with English canonical segments for remapping", () => {
  const source = readFileSync(resolve("site/packages/domain/src/notice-stored-titles.ts"), "utf8");
  expect(source).toContain("EN / RU");
  expect(source).not.toMatch(/locale\s*===/u);
  expect(canonicalNoticeTitle(noticeStoredTitles.newServerUpdate)).toBe("New server update");
  expect(canonicalNoticeTitle(noticeStoredTitles.newFollower)).toBe("New Follower");
  expect(canonicalNoticeTitle(noticeStoredTitles.passwordResetCompleted)).toBe(
    "Password reset completed",
  );
  expect(canonicalNoticeTitle(noticeStoredTitles.verificationApproved)).toBe(
    "Verification approved",
  );
  expect(canonicalNoticeTitle(noticeStoredTitles.newArticleComment)).toBe("New article comment");
  expect(canonicalNoticeTitle(noticeStoredTitles.resourceVersionPublished)).toBe(
    "Resource version published",
  );
  expect(canonicalNoticeTitle(noticeStoredTitles.licenseExpired)).toBe("License expired");
  expect(canonicalNoticeTitle(noticeStoredTitles.licenseExpiresSoon)).toBe("License expires soon");
  expect(canonicalNoticeTitle(noticeStoredMessages.passwordResetCompleted)).toBe(
    "Your password was reset and all existing sessions were signed out.",
  );
  expect(canonicalNoticeTitle(noticeStoredMessages.discussionReplyFollowed)).toBe(
    "A publication you follow has a new reply.",
  );
  // newArticleComment remains remapping-only; live discussion fanout uses newDiscussionReply.
  expect(source).toContain("newArticleComment:");
  expect(source).toContain("newDiscussionReply:");
});
