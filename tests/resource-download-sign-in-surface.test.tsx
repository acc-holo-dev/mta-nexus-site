import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getDictionary } from "../site/src/lib/i18n";
import { ResourceDownloadError } from "../site/src/lib/resource-download-client";

const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanup: null as (() => void) | null,
}));

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useEffect: (effect: () => () => void) => {
    h.cleanup?.();
    h.cleanup = effect();
  },
  useState: (initial: unknown) => {
    const i = h.cursor++;
    if (!(i in h.slots)) h.slots[i] = initial;
    return [
      h.slots[i],
      (v: unknown) => {
        h.slots[i] = typeof v === "function" ? (v as (p: unknown) => unknown)(h.slots[i]) : v;
      },
    ];
  },
  useRef: (initial: unknown) => {
    const i = h.cursor++;
    if (!(i in h.slots)) h.slots[i] = { current: initial };
    return h.slots[i];
  },
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/market/resource" }));
vi.mock("../site/src/components/locale-context", () => ({
  useNexusLocale: () => ({
    locale: "en",
    dictionary: getDictionary("en"),
  }),
}));
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({
      href,
      children,
      ...props
    }: {
      href: string;
      children: ReactNode;
      [key: string]: unknown;
    }) => React.createElement("a", { href, ...props }, children),
  };
});
vi.mock("@nexus/ui", async () => {
  const React = await import("react");
  return {
    Button: ({
      onClick,
      children,
      ...props
    }: {
      onClick?: () => void;
      children: ReactNode;
      [key: string]: unknown;
    }) => React.createElement("button", { type: "button", onClick, ...props }, children),
    ErrorState: ({
      title,
      description,
      action,
    }: {
      title: string;
      description?: string;
      action?: ReactNode;
    }) =>
      React.createElement(
        "div",
        { role: "alert" },
        React.createElement("h2", null, title),
        description ? React.createElement("p", null, description) : null,
        action ? React.createElement("div", null, action) : null,
      ),
  };
});
vi.mock("../site/src/lib/resource-download-client", async (original) => {
  const actual = await original<typeof import("../site/src/lib/resource-download-client")>();
  return {
    ...actual,
    fetchResourceDownload: vi.fn(),
  };
});

import { ResourceDownloadButton } from "../site/src/components/resource-download-button";
import { fetchResourceDownload } from "../site/src/lib/resource-download-client";

type Element = ReactElement<Record<string, unknown>>;
function nodes(n: ReactNode): Element[] {
  if (Array.isArray(n)) return n.flatMap(nodes);
  if (!n || typeof n !== "object" || !("props" in n)) return [];
  const e = n as Element;
  return [e, ...nodes(e.props.children as ReactNode)];
}

beforeEach(() => {
  h.slots = [];
  h.cursor = 0;
  h.cleanup = null;
  vi.clearAllMocks();
  vi.stubGlobal("window", {
    location: { pathname: "/market/resource", search: "", hash: "" },
  });
});

afterEach(() => {
  h.cleanup?.();
  h.cleanup = null;
  vi.unstubAllGlobals();
});

it("offers login and register after an unauthorized download attempt", async () => {
  vi.mocked(fetchResourceDownload).mockRejectedValueOnce(new ResourceDownloadError("signIn"));
  function renderDownload() {
    h.cursor = 0;
    return nodes(ResourceDownloadButton({ productId: "prd_a", version: "1.0.0" }));
  }
  const tree = renderDownload();
  const button = tree.find(
    (node) =>
      typeof node.props.onClick === "function" && node.props["data-download-intent"] === "latest",
  );
  if (!button) {
    throw new Error(
      `Missing download button; saw ${tree.map((node) => String(node.type)).join(", ")}`,
    );
  }
  await (button.props.onClick as () => Promise<void>)();
  h.cursor = 0;
  h.cleanup?.();
  h.cleanup = null;
  const html = renderToStaticMarkup(
    ResourceDownloadButton({ productId: "prd_a", version: "1.0.0" }),
  );
  expect(html).toContain('href="/auth/login?next=%2Fmarket%2Fresource"');
  expect(html).toContain('href="/auth/register?next=%2Fmarket%2Fresource"');
  expect(html).toContain(getDictionary("en").workspace.createAccount);
});
