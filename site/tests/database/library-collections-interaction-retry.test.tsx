import { expect, it, vi } from "vitest";
import {
  createLibraryCollectionsInteractionHelpers,
  mockReactHooks,
} from "../helpers/library-collections-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn(),
  cleanup: null as (() => void) | null,
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../../src/components/confirm-action", () => ({
  confirmAction,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: harness.refresh, push: harness.push }),
}));

import { LibraryCollectionCommandForm } from "../../src/components/library-collection-command";

const { collection, render, submit, success } = createLibraryCollectionsInteractionHelpers(
  harness,
  LibraryCollectionCommandForm,
  confirmAction,
);

it("retries the same UUID and exact command after an ambiguous timeout", async () => {
  harness.fetch.mockRejectedValueOnce(new Error("timeout"));
  await submit(render());
  const first = harness.fetch.mock.calls[0]?.[1] as RequestInit,
    command = JSON.parse(String(first.body));
  expect(harness.refresh).not.toHaveBeenCalled();
  expect(harness.push).not.toHaveBeenCalled();
  harness.fetch.mockResolvedValueOnce(success(command, { ...collection, revision: 5 }));
  await submit(render());
  expect(harness.fetch.mock.calls[1]?.[1].body).toBe(first.body);
  expect(harness.refresh).toHaveBeenCalledOnce();
});

it.each(["en", "ru"] as const)(
  "keeps the endpoint, snapshot and resource on an uncertain %s retry after new props",
  async (locale) => {
    harness.fetch.mockRejectedValueOnce(new Error("lost"));
    await submit(
      render("remove", undefined, { locale, returnHref: "/workspace/library/prd_a/collections" }),
    );
    const [url, init] = harness.fetch.mock.calls[0] as [string, RequestInit];
    const command = JSON.parse(String(init.body));
    harness.fetch.mockResolvedValueOnce(success(command, { ...collection, revision: 5 }));
    await submit(
      render("remove", undefined, {
        locale,
        collection: { ...collection, id: "lcol_other", revision: 9 },
        productId: "prd_other",
        action: "add",
      }),
    );
    expect(harness.fetch.mock.calls[1]?.[0]).toBe(url);
    expect(harness.fetch.mock.calls[1]?.[1].body).toBe(init.body);
    expect(harness.refresh).toHaveBeenCalledOnce();
    expect(harness.push).not.toHaveBeenCalled();
  },
);

it("retains an exact UUID retry on a rate limit", async () => {
  harness.fetch.mockResolvedValueOnce({
    ok: false,
    status: 429,
    json: async () => ({ code: "RATE_LIMIT_EXCEEDED" }),
  });
  await submit(render());
  const init = harness.fetch.mock.calls[0]?.[1] as RequestInit;
  harness.fetch.mockResolvedValueOnce(
    success(JSON.parse(String(init.body)), { ...collection, revision: 5 }),
  );
  await submit(render());
  expect(harness.fetch.mock.calls[1]?.[1].body).toBe(init.body);
  expect(harness.refresh).toHaveBeenCalledOnce();
});
