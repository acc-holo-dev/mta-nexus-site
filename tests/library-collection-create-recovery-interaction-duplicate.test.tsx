import { expect, it, vi } from "vitest";
import {
  createLibraryCollectionCreateRecoveryInteractionHelpers,
  mockReactHooks,
  reply,
} from "./helpers/library-collection-create-recovery-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effects: [] as (() => unknown)[],
  fetch: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  confirm: vi.fn(async () => true),
}));
vi.mock("../apps/web/src/components/confirm-action", () => ({ confirmAction: harness.confirm }));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: harness.push, refresh: harness.refresh }),
}));

import { LibraryCollectionCommandForm } from "../apps/web/src/components/library-collection-command";

const { renderDuplicate, mountDuplicate, submitDuplicate, collectionPosts, hasLateResultTitle } =
  createLibraryCollectionCreateRecoveryInteractionHelpers(harness, LibraryCollectionCommandForm);

it("recovers the exact duplicate command after loss, reload and source revision change", async () => {
  await mountDuplicate();
  harness.fetch.mockRejectedValueOnce(new Error("lost"));
  await submitDuplicate();
  const key = "nexus:collection-duplicate:v1:usr_a:lcol_src";
  const saved = sessionStorage.getItem(key);
  expect(saved).toContain('"expectedRevision":4');
  const original = harness.fetch.mock.calls.find(([url]) => url === "/api/library/collections")?.[1]
    .body;
  harness.slots = [];
  await mountDuplicate(5);
  expect(
    harness.slots.some(
      (value) =>
        typeof value === "object" &&
        value !== null &&
        "current" in value &&
        (value as { current?: { command?: { action?: string } } }).current?.command?.action ===
          "duplicate",
    ),
  ).toBe(true);
  expect(renderDuplicate(5).find((node) => node.type === "input")?.props.disabled).toBe(true);
  harness.fetch.mockResolvedValueOnce(reply({ code: "RATE_LIMITED" }, 429));
  await submitDuplicate(5);
  expect(sessionStorage.getItem(key)).toBe(saved);
  const posts = collectionPosts();
  expect(posts).toHaveLength(2);
  expect(posts[1]?.[1].body).toBe(original);
});

it("serializes double submission while awaiting copy confirmation", async () => {
  await mountDuplicate();
  let resolveConfirm!: (value: boolean) => void;
  harness.confirm.mockReturnValueOnce(
    new Promise<boolean>((resolve) => {
      resolveConfirm = resolve;
    }),
  );
  const first = submitDuplicate();
  await submitDuplicate();
  expect(harness.confirm).toHaveBeenCalledTimes(1);
  harness.fetch.mockRejectedValueOnce(new Error("lost"));
  resolveConfirm(true);
  await first;
  const key = "nexus:collection-duplicate:v1:usr_a:lcol_src";
  const stored = sessionStorage.getItem(key);
  if (!stored) throw Error("Missing copy intent");
  const posts = collectionPosts();
  expect(posts).toHaveLength(1);
  expect(JSON.parse(stored).command).toEqual(JSON.parse(String(posts[0]?.[1].body)));
  harness.slots = [];
  await mountDuplicate();
  harness.fetch.mockResolvedValueOnce(reply({ code: "RATE_LIMITED" }, 429));
  await submitDuplicate();
  const retries = collectionPosts();
  expect(retries).toHaveLength(2);
  expect(retries[1]?.[1].body).toBe(retries[0]?.[1].body);
});

it("unlocks copy after a cancelled confirmation", async () => {
  await mountDuplicate();
  harness.confirm.mockResolvedValueOnce(false);
  await submitDuplicate();
  expect(collectionPosts()).toHaveLength(0);
  harness.fetch.mockRejectedValueOnce(new Error("lost"));
  await submitDuplicate();
  expect(harness.confirm).toHaveBeenCalledTimes(2);
  expect(collectionPosts()).toHaveLength(1);
});

it("ignores a late confirmation error from actor A after the form receives actor B", async () => {
  await mountDuplicate();
  let reject!: (reason: Error) => void;
  harness.confirm.mockReturnValueOnce(
    new Promise<boolean>((_resolve, fail) => {
      reject = fail;
    }),
  );
  const pending = submitDuplicate();
  await vi.waitFor(() => expect(harness.confirm).toHaveBeenCalledTimes(1));
  expect(renderDuplicate(4, "usr_b").find((node) => node.type === "form")?.props.hidden).toBe(true);
  reject(new Error("confirmation failed"));
  await pending;
  expect(hasLateResultTitle(renderDuplicate(4, "usr_b"))).toBe(false);
  expect(collectionPosts()).toHaveLength(0);
});
