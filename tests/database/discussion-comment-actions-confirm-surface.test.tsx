import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { getDiscussionCopy } from "../../site/src/lib/content-discussion-copy";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

it("gates own and moderator comment removal behind confirmAction with localized copy", () => {
  const source = read("site/src/components/discussion-comment-actions.tsx");
  const i18n = read("site/src/lib/content-discussion-copy.ts");

  expect(source).toContain('import { confirmAction } from "./confirm-action"');
  expect(source).toContain("copy.removeConfirmTitle");
  expect(source).toContain("copy.moderateRemoveConfirmTitle");
  expect(source).toContain("danger: true");
  expect(source).toContain("void removeOwn()");

  const ownConfirmAt = source.indexOf("copy.removeConfirmTitle");
  const ownDeleteAt = source.indexOf('mutateComment("remove"');
  const modConfirmAt = source.lastIndexOf("copy.moderateRemoveConfirmTitle");
  const modDeleteAt = source.indexOf('next === "edit" ? "PATCH" : "DELETE"');
  expect(ownConfirmAt).toBeGreaterThan(-1);
  expect(ownDeleteAt).toBeGreaterThan(ownConfirmAt);
  expect(modConfirmAt).toBeGreaterThan(-1);
  expect(modDeleteAt).toBeGreaterThan(-1);

  const en = getDiscussionCopy("en");
  const ru = getDiscussionCopy("ru");
  expect(en.removeConfirmTitle).not.toBe(ru.removeConfirmTitle);
  expect(en.moderateRemoveConfirmTitle).not.toBe(ru.moderateRemoveConfirmTitle);
  expect(en.removeNote).not.toBe(ru.removeNote);
  expect(en.moderateRemoveNote).not.toBe(ru.moderateRemoveNote);
  expect(en.confirmRemove).not.toBe(ru.confirmRemove);
  expect(en.cancelEdit).not.toBe(ru.cancelEdit);
  expect(i18n).toContain("removeConfirmTitle");
  expect(i18n).toContain("moderateRemoveConfirmTitle");
});
