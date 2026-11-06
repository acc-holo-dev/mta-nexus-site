import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { formatNotification } from "../apps/web/src/lib/notification-copy";

const reviewCopy = { approved: "", rejected: "", version: "", notes: "" };

it("deep-links non-server verification resolutions to the requester application page", () => {
  const source = readFileSync(resolve("packages/db/src/repositories/verification.ts"), "utf8");
  expect(source).toContain("function verificationRequesterHref(requestId: string)");
  expect(source).toMatch(
    /return `\/workspace\/verification\/\$\{encodeURIComponent\(requestId\)\}`;/u,
  );
  expect(source).toContain('return "/workspace/verification/history"');
  expect(source).toContain("verificationRequesterHref(request.id)");
  expect(source).not.toContain("`/workspace/verification?view=history`");
  expect(source).toMatch(
    /`\/workspace\/servers\/\$\{encodeURIComponent\(request\.targetId\)\}`/u,
  );
});

it.each(["en", "ru"] as const)(
  "localizes requester resolution copy with a workspace destination cue and no raw ids in %s",
  (locale) => {
    const result = formatNotification(
      {
        title: "Verification approved",
        message: "developer verification for usr_secret was approved.",
      },
      reviewCopy,
      locale,
    );
    expect(result.title).toBe(locale === "ru" ? "Верификация одобрена" : "Verification approved");
    expect(result.message.toLowerCase()).toContain(locale === "ru" ? "рабоч" : "workspace");
    expect(result.message).not.toContain("usr_secret");
    expect(result.message).not.toMatch(/ver_/u);
  },
);
