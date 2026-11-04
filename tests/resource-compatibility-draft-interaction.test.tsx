import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { findTestButton, flattenReactTestTree } from "./helpers/flatten-react-test-tree";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
  locale: "en" as "en" | "ru",
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.slots)) harness.slots[index] = initial;
    return [
      harness.slots[index],
      (value: unknown) => {
        harness.slots[index] = typeof value === "function" ? value(harness.slots[index]) : value;
      },
    ];
  },
  useRef: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.slots)) harness.slots[index] = { current: initial };
    return harness.slots[index];
  },
  useId: () => "compatibility-field",
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));
vi.mock("../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: harness.locale }),
}));

import { ResourceCompatibilityForm } from "../apps/web/src/components/resource-compatibility-form";
import { getResourceManagementCopy } from "../apps/web/src/lib/resource-management-i18n";

const revision = "2026-10-11T00:00:00.000Z";
const later = "2026-10-11T00:00:01.000Z";
const original = {
  id: "prd_a",
  updatedAt: revision,
  suspended: false,
  compatibility: { mtaMinVersion: "1.6.0", dependencies: ["resource-a"] },
};
const latest = {
  ...original,
  updatedAt: later,
  compatibility: { mtaMinVersion: "1.6.1", dependencies: ["resource-b"] },
};
const actor = {
  id: "usr_a",
  username: "author",
  displayName: "Author",
  bio: "",
  avatarUrl: "",
  updatedAt: revision,
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
function render(product = original) {
  harness.cursor = 0;
  return flattenReactTestTree(
    ResourceCompatibilityForm({ actorId: "usr_a", product }) as ReactNode,
  );
}
function edit() {
  const nodes = render();
  const dependencies = nodes.find((node) => node.type === "textarea");
  if (!dependencies) throw Error("Missing dependency editor");
  (dependencies.props.onChange as (event: unknown) => void)({ target: { value: "my-resource" } });
}
function submit(nodes = render()) {
  const form = nodes.find((node) => node.type === "form");
  if (!form) throw Error("Missing compatibility form");
  (form.props.onSubmit as (event: unknown) => void)({ preventDefault() {} });
}
beforeEach(() => {
  vi.clearAllMocks();
  harness.slots = [];
  harness.cursor = 0;
  harness.fetch.mockReset();
  harness.refresh.mockReset();
  vi.stubGlobal("fetch", harness.fetch);
});
afterEach(() => vi.unstubAllGlobals());

it.each(["en", "ru"] as const)(
  "keeps the draft after 409 and requires comparison in %s",
  async (locale) => {
    harness.locale = locale;
    const copy = getResourceManagementCopy(locale);
    edit();
    harness.fetch.mockResolvedValueOnce(response({ code: "PRODUCT_METADATA_CONFLICT" }, 409));
    submit();
    await vi.waitFor(() => expect(findTestButton(render(), copy.compatibilityCheck)).toBeDefined());
    expect(harness.refresh).not.toHaveBeenCalled();
    expect(render().find((node) => node.type === "textarea")?.props.value).toBe("my-resource");
    harness.fetch
      .mockResolvedValueOnce(response({ profile: actor }))
      .mockResolvedValueOnce(response({ actorId: "usr_a", product: latest }));
    (findTestButton(render(), copy.compatibilityCheck).props.onClick as () => void)();
    await vi.waitFor(() =>
      expect(findTestButton(render(), copy.compatibilityUseLatest)).toBeDefined(),
    );
    expect(render().find((node) => node.type === "textarea")?.props.value).toBe("my-resource");
    (findTestButton(render(), copy.compatibilityUseLatest).props.onClick as () => void)();
    harness.fetch.mockResolvedValueOnce(response({ code: "PRODUCT_METADATA_CONFLICT" }, 409));
    submit();
    await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledTimes(4));
    const init = harness.fetch.mock.calls[3]?.[1] as RequestInit;
    expect(new Headers(init.headers).get("x-nexus-actor-id")).toBe("usr_a");
    expect(JSON.parse(String(init.body))).toMatchObject({
      expectedUpdatedAt: later,
      compatibility: { dependencies: ["my-resource"] },
    });
  },
);

it("closes the previous draft if either identity check detects a different actor", async () => {
  harness.locale = "en";
  const copy = getResourceManagementCopy("en");
  edit();
  harness.fetch.mockResolvedValueOnce(response({ code: "PRODUCT_METADATA_CONFLICT" }, 409));
  submit();
  await vi.waitFor(() => expect(findTestButton(render(), copy.compatibilityCheck)).toBeDefined());
  harness.fetch
    .mockResolvedValueOnce(response({ profile: actor }))
    .mockResolvedValueOnce(response({ actorId: "usr_other", product: latest }));
  (findTestButton(render(), copy.compatibilityCheck).props.onClick as () => void)();
  await vi.waitFor(() =>
    expect(render().some((node) => node.props.title === copy.compatibilityIdentityChanged)).toBe(
      true,
    ),
  );
  expect(render().some((node) => node.type === "textarea")).toBe(false);
});

it("closes the draft when the server detects an actor change during the write", async () => {
  harness.locale = "en";
  const copy = getResourceManagementCopy("en");
  edit();
  harness.fetch.mockResolvedValueOnce(response({ code: "ACTOR_CHANGED" }, 409));
  submit();
  await vi.waitFor(() =>
    expect(render().some((node) => node.props.title === copy.compatibilityIdentityChanged)).toBe(
      true,
    ),
  );
  expect(render().some((node) => node.type === "textarea")).toBe(false);
  expect(
    render().some(
      (node) => node.type === "button" && node.props.children === copy.compatibilityCheck,
    ),
  ).toBe(false);
});

it("keeps a draft available to the verified actor when management access is revoked", async () => {
  harness.locale = "en";
  const copy = getResourceManagementCopy("en");
  edit();
  harness.fetch.mockResolvedValueOnce(response({ code: "NOT_FOUND" }, 404));
  submit();
  await vi.waitFor(() => expect(findTestButton(render(), copy.compatibilityCheck)).toBeDefined());
  harness.fetch
    .mockResolvedValueOnce(response({ profile: actor }))
    .mockResolvedValueOnce(response({ code: "NOT_FOUND" }, 404));
  (findTestButton(render(), copy.compatibilityCheck).props.onClick as () => void)();
  await vi.waitFor(() =>
    expect(render().some((node) => node.props.title === copy.compatibilityCheckFailed)).toBe(true),
  );
  expect(render().find((node) => node.type === "textarea")?.props.value).toBe("my-resource");
  expect(findTestButton(render(), copy.save).props.disabled).toBe(true);
});
