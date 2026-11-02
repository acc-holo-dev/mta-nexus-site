import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/market/example" }));

import { ResourceQaPanel } from "../apps/web/src/components/resource-qa-panel";
import { resourceQaCopy } from "../apps/web/src/lib/resource-qa-i18n";

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
});
