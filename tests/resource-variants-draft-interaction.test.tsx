import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { findTestButton, flattenReactTestTree } from "./helpers/flatten-react-test-tree";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
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
  useId: () => "variants-field",
}));
vi.mock("../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: harness.locale }),
}));

import { ResourceVariantsForm } from "../apps/web/src/components/resource-variants-form";
import { getResourceManagementCopy } from "../apps/web/src/lib/resource-management-i18n";

const variant = {
  productId: "prd_a",
  title: "Resource A",
  label: "Base",
  slug: "resource-a",
  currentVersion: "1.0",
  status: "published" as const,
};
const managed = {
  anchorProductId: "prd_a",
  group: { id: "vgrp_a", revision: 2, title: "Original group", variants: [variant] },
};
const latest = { ...managed, group: { ...managed.group, revision: 3, title: "Changed elsewhere" } };
const actor = {
  id: "usr_a",
  username: "author",
  displayName: "Author",
  bio: "",
  avatarUrl: "",
  updatedAt: "2026-10-11T00:00:00.000Z",
};
const response = (body: unknown, status = 200, actorId?: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...(actorId ? { "x-nexus-actor-id": actorId } : {}),
    },
  });
function render(snapshot = managed) {
  harness.cursor = 0;
  return flattenReactTestTree(
    ResourceVariantsForm({
      actorId: "usr_a",
      product: { id: "prd_a", title: "Resource A" },
      managed: snapshot,
      initialCandidates: { candidates: [], page: 1, hasMore: false },
    }) as ReactNode,
  );
}
function edit() {
  const nodes = render();
  const title = nodes.find((node) => node.props.id === "variants-field-title");
  const reason = nodes.find((node) => node.props.id === "variants-field-reason");
  if (!title || !reason) throw Error("Missing group editor");
  (title.props.onChange as (event: unknown) => void)({ target: { value: "My draft group" } });
  (reason.props.onChange as (event: unknown) => void)({ target: { value: "My draft reason" } });
}
function submit(nodes = render()) {
  const form = nodes.find((node) => node.type === "form");
  if (!form) throw Error("Missing group form");
  (form.props.onSubmit as (event: unknown) => void)({ preventDefault() {} });
}
beforeEach(() => {
  vi.clearAllMocks();
  harness.slots = [];
  harness.cursor = 0;
  harness.fetch.mockReset();
  vi.stubGlobal("fetch", harness.fetch);
});
afterEach(() => vi.unstubAllGlobals());

it.each(["en", "ru"] as const)(
  "keeps group edits through a 409 and explicitly accepts the checked revision in %s",
  async (locale) => {
    harness.locale = locale;
    const copy = getResourceManagementCopy(locale);
    edit();
    harness.fetch.mockResolvedValueOnce(response({ code: "RESOURCE_VARIANTS_CONFLICT" }, 409));
    submit();
    await vi.waitFor(() => expect(findTestButton(render(), copy.variantsCheck)).toBeDefined());
    expect(render().find((node) => node.props.id === "variants-field-title")?.props.value).toBe(
      "My draft group",
    );
    harness.fetch
      .mockResolvedValueOnce(response({ profile: actor }))
      .mockResolvedValueOnce(response(latest, 200, "usr_a"));
    (findTestButton(render(), copy.variantsCheck).props.onClick as () => void)();
    await vi.waitFor(() => expect(findTestButton(render(), copy.variantsUseLatest)).toBeDefined());
    expect(render().find((node) => node.props.id === "variants-field-reason")?.props.value).toBe(
      "My draft reason",
    );
    (findTestButton(render(), copy.variantsUseLatest).props.onClick as () => void)();
    harness.fetch.mockResolvedValueOnce(response({ code: "RESOURCE_VARIANTS_CONFLICT" }, 409));
    submit();
    await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledTimes(4));
    const init = harness.fetch.mock.calls[3]?.[1] as RequestInit;
    expect(new Headers(init.headers).get("x-nexus-actor-id")).toBe("usr_a");
    expect(JSON.parse(String(init.body))).toMatchObject({
      expectedGroupId: "vgrp_a",
      expectedRevision: 3,
      title: "My draft group",
      reason: "My draft reason",
      variants: [{ productId: "prd_a", label: "Base" }],
    });
  },
);

it("hides the prior draft when the active actor changes during the write", async () => {
  harness.locale = "en";
  const copy = getResourceManagementCopy("en");
  edit();
  harness.fetch.mockResolvedValueOnce(response({ code: "ACTOR_CHANGED" }, 409));
  submit();
  await vi.waitFor(() =>
    expect(render().some((node) => node.props.title === copy.variantsIdentityChanged)).toBe(true),
  );
  expect(render().some((node) => node.props.id === "variants-field-title")).toBe(false);
});

it("keeps the draft for the verified actor when group access is revoked", async () => {
  harness.locale = "en";
  const copy = getResourceManagementCopy("en");
  edit();
  harness.fetch.mockResolvedValueOnce(response({ code: "NOT_FOUND" }, 404));
  submit();
  await vi.waitFor(() => expect(findTestButton(render(), copy.variantsCheck)).toBeDefined());
  harness.fetch
    .mockResolvedValueOnce(response({ profile: actor }))
    .mockResolvedValueOnce(response({ code: "NOT_FOUND" }, 404))
    .mockResolvedValueOnce(response({ profile: actor }));
  (findTestButton(render(), copy.variantsCheck).props.onClick as () => void)();
  await vi.waitFor(() =>
    expect(render().some((node) => node.props.title === copy.variantsCheckFailed)).toBe(true),
  );
  expect(render().find((node) => node.props.id === "variants-field-title")?.props.value).toBe(
    "My draft group",
  );
  expect(findTestButton(render(), copy.save).props.disabled).toBe(true);
});

it("keeps the draft but does not accept a group whose anchor changed", async () => {
  harness.locale = "en";
  const copy = getResourceManagementCopy("en");
  edit();
  harness.fetch.mockResolvedValueOnce(response({ code: "RESOURCE_VARIANTS_CONFLICT" }, 409));
  submit();
  await vi.waitFor(() => expect(findTestButton(render(), copy.variantsCheck)).toBeDefined());
  harness.fetch
    .mockResolvedValueOnce(response({ profile: actor }))
    .mockResolvedValueOnce(response({ ...latest, anchorProductId: "prd_other" }, 200, "usr_a"));
  (findTestButton(render(), copy.variantsCheck).props.onClick as () => void)();
  await vi.waitFor(() =>
    expect(render().some((node) => node.props.children === copy.variantsAnchorChanged)).toBe(true),
  );
  expect(
    render().some(
      (node) => node.type === "button" && node.props.children === copy.variantsUseLatest,
    ),
  ).toBe(false);
  expect(render().find((node) => node.props.id === "variants-field-title")?.props.value).toBe(
    "My draft group",
  );
});

it("closes a draft when the actor changes between identity and group reads", async () => {
  harness.locale = "en";
  const copy = getResourceManagementCopy("en");
  edit();
  harness.fetch.mockResolvedValueOnce(response({ code: "RESOURCE_VARIANTS_CONFLICT" }, 409));
  submit();
  await vi.waitFor(() => expect(findTestButton(render(), copy.variantsCheck)).toBeDefined());
  harness.fetch
    .mockResolvedValueOnce(response({ profile: actor }))
    .mockResolvedValueOnce(response(latest, 200, "usr_other"));
  (findTestButton(render(), copy.variantsCheck).props.onClick as () => void)();
  await vi.waitFor(() =>
    expect(render().some((node) => node.props.title === copy.variantsIdentityChanged)).toBe(true),
  );
  expect(render().some((node) => node.props.id === "variants-field-title")).toBe(false);
});

it("does not reveal the draft if the actor changes after access is denied", async () => {
  harness.locale = "en";
  const copy = getResourceManagementCopy("en");
  edit();
  harness.fetch.mockResolvedValueOnce(response({ code: "NOT_FOUND" }, 404));
  submit();
  await vi.waitFor(() => expect(findTestButton(render(), copy.variantsCheck)).toBeDefined());
  harness.fetch
    .mockResolvedValueOnce(response({ profile: actor }))
    .mockResolvedValueOnce(response({ code: "NOT_FOUND" }, 404))
    .mockResolvedValueOnce(response({ profile: { ...actor, id: "usr_other" } }));
  (findTestButton(render(), copy.variantsCheck).props.onClick as () => void)();
  await vi.waitFor(() =>
    expect(render().some((node) => node.props.title === copy.variantsIdentityChanged)).toBe(true),
  );
  expect(render().some((node) => node.props.id === "variants-field-title")).toBe(false);
});
