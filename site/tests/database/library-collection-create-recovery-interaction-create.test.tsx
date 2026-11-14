import { expect, it, vi } from "vitest";
import {
  createLibraryCollectionCreateRecoveryInteractionHelpers,
  mockReactHooks,
  reply,
} from "../helpers/library-collection-create-recovery-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effects: [] as (() => unknown)[],
  fetch: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  confirm: vi.fn(async () => true),
}));
vi.mock("../../src/components/confirm-action", () => ({ confirmAction: harness.confirm }));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: harness.push, refresh: harness.refresh }),
}));

import { LibraryCollectionCommandForm } from "../../src/components/library-collection-command";

const { render, mount, changeName, submit, collectionPosts } =
  createLibraryCollectionCreateRecoveryInteractionHelpers(harness, LibraryCollectionCommandForm);

it("retains the original creation after loss, reload and a rate-limited retry", async () => {
  await mount();
  changeName("Private collection");
  harness.fetch.mockRejectedValueOnce(new Error("lost"));
  await submit();
  const key = "nexus:collection-create:v1:usr_a";
  const saved = sessionStorage.getItem(key);
  expect(saved).toContain("Private collection");
  const firstPost = harness.fetch.mock.calls.find(([url]) => url === "/api/library/collections");
  harness.slots = [];
  await mount();
  expect(render().find((node) => node.type === "input")?.props.disabled).toBe(true);
  harness.fetch.mockResolvedValueOnce(reply({ code: "RATE_LIMITED" }, 429));
  await submit();
  expect(sessionStorage.getItem(key)).toBe(saved);
  const posts = collectionPosts();
  expect(posts).toHaveLength(2);
  expect(posts[1]?.[1].body).toBe(firstPost?.[1].body);
  expect(posts[1]?.[1].headers["x-nexus-actor-id"]).toBe("usr_a");
});

it("blocks the first POST when storage fails and unlocks after a definite first rejection", async () => {
  await mount();
  changeName("Private collection");
  const original = sessionStorage;
  vi.stubGlobal("sessionStorage", {
    getItem: () => null,
    setItem: () => {
      throw Error("denied");
    },
    removeItem: () => {},
  });
  await submit();
  expect(collectionPosts()).toHaveLength(0);
  vi.stubGlobal("sessionStorage", original);
  harness.fetch.mockResolvedValueOnce(reply({ code: "RATE_LIMITED" }, 429));
  await submit();
  expect(sessionStorage.getItem("nexus:collection-create:v1:usr_a")).toBeNull();
  expect(render().find((node) => node.type === "input")?.props.disabled).toBe(false);
});

it("clears a confirmed creation before navigating", async () => {
  await mount();
  changeName("Private collection");
  harness.fetch.mockImplementationOnce(async (_url: string, init: RequestInit) => {
    const command = JSON.parse(String(init.body));
    return reply({
      replayed: false,
      receipt: {
        id: "lcr_a",
        requestId: command.requestId,
        command,
        collection: { id: "lcol_a", name: command.name, status: "active", revision: 1 },
        createdAt: "2026-10-11T00:00:00.000Z",
      },
    });
  });
  await submit();
  expect(sessionStorage.getItem("nexus:collection-create:v1:usr_a")).toBeNull();
  expect(harness.push).toHaveBeenCalledOnce();
});
