import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { supportMessageCopy } from "./support-message-discovery-copy";
import { supportThreadMessageFrame } from "./support-thread-message-frame";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "components/support-case-thread.tsx"),
  "utf8",
);

it("uses ErrorState for a counted thread with no rows and EmptyState when the thread is empty", () => {
  expect(supportThreadMessageFrame(0, 601)).toBe("load-error");
  expect(supportThreadMessageFrame(0, 0)).toBe("empty");
  expect(supportThreadMessageFrame(2, 2)).toBe("messages");
  expect(source).toContain(
    'supportThreadMessageFrame(messages.length, messageTotal) === "load-error"',
  );
  expect(source).toContain("copy.caseLoadError");
  expect(source).toContain("copy.caseLoadErrorHint");
  expect(source).toContain('supportThreadMessageFrame(messages.length, messageTotal) === "empty"');
  expect(source).toContain("supportMessageCopy(locale).empty");
  expect(source).toContain("supportMessageCopy(locale).emptyDescription");
  expect(supportMessageCopy("en").empty).not.toBe(supportMessageCopy("en").unavailable);
  expect(supportMessageCopy("ru").emptyDescription).not.toBe(
    supportMessageCopy("ru").unavailableHint,
  );
});
