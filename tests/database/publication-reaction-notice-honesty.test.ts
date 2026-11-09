import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { formatNotification } from "../../apps/web/src/lib/notification-copy";

const reviewCopy = { approved: "", rejected: "", version: "", notes: "" };

it("stores publication and reaction notices without raw content ids in messages", () => {
  const publication = readFileSync(
    resolve("packages/db/src/repositories/publication-notice.ts"),
    "utf8",
  );
  const reaction = readFileSync(
    resolve("packages/db/src/repositories/content-reaction-notice.ts"),
    "utf8",
  );
  expect(publication).toContain('kind: "publication_activity"');
  expect(publication).not.toMatch(/Publication \$\{item\.id\}/u);
  expect(reaction).toContain('kind: "content_reaction"');
  expect(reaction).not.toMatch(/Publication \$\{item\.id\}/u);
});

it.each(["en", "ru"] as const)(
  "localizes structured publication and reaction notices with titles in %s",
  (locale) => {
    const activity = formatNotification(
      {
        title: "Publication activity",
        message: "stored",
        data: {
          kind: "publication_activity",
          event: "published",
          contentId: "cnt_secret",
          contentTitle: "Northwind Notes",
          contentSlug: "northwind-notes",
        },
      },
      reviewCopy,
      locale,
    );
    const reaction = formatNotification(
      {
        title: "Publication reaction",
        message: "stored",
        data: {
          kind: "content_reaction",
          contentId: "cnt_secret",
          contentTitle: "Northwind Notes",
          contentSlug: "northwind-notes",
        },
      },
      reviewCopy,
      locale,
    );
    expect(activity.message).toContain("Northwind Notes");
    expect(activity.message).not.toContain("cnt_secret");
    expect(reaction.message).toContain("Northwind Notes");
    expect(reaction.message).not.toContain("cnt_secret");
  },
);
