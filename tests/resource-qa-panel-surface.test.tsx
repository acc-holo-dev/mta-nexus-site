import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/market/example" }));

import { ResourceQaPanel } from "../apps/web/src/components/resource-qa-panel";
import { resourceQaCopy } from "../apps/web/src/lib/resource-qa-i18n";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const thread = {
  id: "rqa_thread",
  body: "Does this work on 1.6?",
  status: "open" as const,
  revision: 1,
  answerCount: 0,
  buildContext: { version: "1.2.0", available: false },
  resolvedAnswerId: null,
  createdAt: new Date("2026-10-01T00:00:00.000Z"),
  updatedAt: null,
  author: { username: "author", displayName: "Author" },
};

const capabilities = {
  canAsk: false,
  canAnswer: false,
  canResolve: false,
  askReason: "resource_unavailable" as const,
};

it("shows a public-read notice for guests and stale build context in the list", () => {
  const copy = resourceQaCopy("en");
  const html = renderToStaticMarkup(
    <ResourceQaPanel
      productId="prd_aaaaaaaaaaaaaaaaaaaaaaaa"
      locale="en"
      authenticated={false}
      canManage={false}
      builds={[]}
      initial={{ threads: [thread], capabilities: { ...capabilities, askReason: "sign_in" } }}
    />,
  );
  expect(html).toContain(copy.publicRead);
  expect(html).toContain(copy.signIn);
  expect(html).toContain(copy.buildUnavailable);
  expect(html).not.toContain(copy.ask);
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain("min-h-11");
});

it("explains when a signed-in reader cannot ask", () => {
  const copy = resourceQaCopy("ru");
  const html = renderToStaticMarkup(
    <ResourceQaPanel
      productId="prd_aaaaaaaaaaaaaaaaaaaaaaaa"
      locale="ru"
      authenticated
      canManage={false}
      builds={[]}
      initial={{ threads: [], capabilities }}
    />,
  );
  expect(html).toContain(copy.unavailable);
  expect(html).not.toContain(copy.publicRead);
  expect(html).toContain(copy.empty);
  expect(html).toContain(copy.emptyHint);
  expect(html).toContain("overflow-x-clip");
  expect(html).not.toContain('role="alert"');
});

it("distinguishes ErrorState read failure from EmptyState empty Q&A", () => {
  const copy = resourceQaCopy("en");
  const failure = renderToStaticMarkup(
    <ResourceQaPanel
      productId="prd_aaaaaaaaaaaaaaaaaaaaaaaa"
      locale="en"
      authenticated={false}
      canManage={false}
      builds={[]}
      initial={null}
    />,
  );
  expect(failure).toContain('role="alert"');
  expect(failure).toContain(copy.unavailable);
  expect(failure).toContain(copy.unavailableDescription);
  expect(failure).toContain(copy.retry);
  expect(failure).toContain("overflow-x-clip");
  expect(failure).toContain("min-h-11");
  expect(failure).not.toContain(copy.emptyHint);

  const empty = renderToStaticMarkup(
    <ResourceQaPanel
      productId="prd_aaaaaaaaaaaaaaaaaaaaaaaa"
      locale="en"
      authenticated
      canManage={false}
      builds={[]}
      initial={{ threads: [], capabilities }}
    />,
  );
  expect(empty).toContain(copy.empty);
  expect(empty).toContain(copy.emptyHint);
  expect(empty).toContain("overflow-x-clip");
  expect(empty).not.toContain('role="alert"');
});

it("gates resolve and reopen writes behind confirmAction with localized copy", () => {
  const source = read("apps/web/src/components/resource-qa-panel.tsx");
  const i18n = read("apps/web/src/lib/resource-qa-i18n.ts");

  expect(source).toContain('import { confirmAction } from "./confirm-action"');
  expect(source).toContain("copy.resolveConfirmTitle");
  expect(source).toContain("copy.reopenConfirmTitle");
  expect(source).toContain("danger: false");
  expect(source).toContain("danger: true");

  const resolveConfirmAt = source.indexOf("copy.resolveConfirmTitle");
  const resolveMutateAt = source.indexOf('action: "resolve"');
  const reopenConfirmAt = source.indexOf("copy.reopenConfirmTitle");
  const reopenMutateAt = source.indexOf('action: "reopen"');
  expect(resolveConfirmAt).toBeGreaterThan(-1);
  expect(resolveMutateAt).toBeGreaterThan(resolveConfirmAt);
  expect(reopenConfirmAt).toBeGreaterThan(-1);
  expect(reopenMutateAt).toBeGreaterThan(reopenConfirmAt);

  const en = resourceQaCopy("en");
  const ru = resourceQaCopy("ru");
  expect(en.resolveConfirmTitle).not.toBe(ru.resolveConfirmTitle);
  expect(en.resolveConfirm).not.toBe(ru.resolveConfirm);
  expect(en.reopenConfirmTitle).not.toBe(ru.reopenConfirmTitle);
  expect(en.reopenConfirm).not.toBe(ru.reopenConfirm);
  expect(en.cancel).not.toBe(ru.cancel);
  expect(i18n).toContain("resolveConfirmTitle");
  expect(i18n).toContain("reopenConfirmTitle");
});
