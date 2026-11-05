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

const { render, mount, changeName, submit, collectionPosts, hasLateResultTitle } =
  createLibraryCollectionCreateRecoveryInteractionHelpers(harness, LibraryCollectionCommandForm);

it("does not reveal actor A's draft to a changed account or send under that account", async () => {
  await mount();
  changeName("Private collection");
  harness.fetch.mockRejectedValueOnce(new Error("lost"));
  await submit();
  harness.slots = [];
  harness.fetch.mockResolvedValueOnce(reply({ authenticated: true, user: { id: "usr_b" } }));
  render("usr_a");
  for (const effect of harness.effects) effect();
  await vi.waitFor(() =>
    expect(
      render("usr_a").some(
        (node) =>
          typeof node.props.title === "string" && node.props.title.includes("Could not check"),
      ),
    ).toBe(true),
  );
  expect(render("usr_a").find((node) => node.type === "form")?.props.hidden).toBe(true);
  expect(collectionPosts()).toHaveLength(1);
  harness.slots = [];
  await mount("usr_b");
  expect(render("usr_b").find((node) => node.type === "input")?.props.value).toBe("");
});

it("hides and clears actor A's in-memory draft when the same form receives actor B", async () => {
  await mount();
  changeName("Private collection");
  harness.fetch.mockRejectedValueOnce(new Error("lost"));
  await submit();
  const keyA = "nexus:collection-create:v1:usr_a";
  expect(sessionStorage.getItem(keyA)).toContain("Private collection");
  harness.fetch.mockResolvedValueOnce(reply({ authenticated: true, user: { id: "usr_b" } }));
  expect(render("usr_b").find((node) => node.type === "form")?.props.hidden).toBe(true);
  for (const effect of harness.effects) effect();
  await vi.waitFor(() =>
    expect(render("usr_b").find((node) => node.type === "form")?.props.hidden).toBe(false),
  );
  expect(render("usr_b").find((node) => node.type === "input")?.props.value).toBe("");
  expect(sessionStorage.getItem(keyA)).toContain("Private collection");
});

it("ignores a late actor A success after the same form receives actor B", async () => {
  await mount();
  changeName("Private collection");
  let complete!: (value: Response) => void;
  harness.fetch.mockReturnValueOnce(
    new Promise<Response>((resolve) => {
      complete = resolve;
    }),
  );
  const pending = submit();
  await vi.waitFor(() => expect(collectionPosts()).toHaveLength(1));
  const post = harness.fetch.mock.calls.find(([url]) => url === "/api/library/collections");
  const command = JSON.parse(String(post?.[1].body));
  expect(render("usr_b").find((node) => node.type === "form")?.props.hidden).toBe(true);
  complete(
    reply({
      replayed: false,
      receipt: {
        id: "lcr_a",
        requestId: command.requestId,
        command,
        collection: { id: "lcol_a", name: command.name, status: "active", revision: 1 },
        createdAt: "2026-10-11T00:00:00.000Z",
      },
    }),
  );
  await pending;
  expect(harness.push).not.toHaveBeenCalled();
  expect(harness.refresh).not.toHaveBeenCalled();
  expect(sessionStorage.getItem("nexus:collection-create:v1:usr_a")).toContain(
    "Private collection",
  );
});

it("does not display a late actor A error after the form receives actor B", async () => {
  await mount();
  changeName("Private collection");
  let reject!: (reason: Error) => void;
  harness.fetch.mockReturnValueOnce(
    new Promise<Response>((_resolve, fail) => {
      reject = fail;
    }),
  );
  const pending = submit();
  await vi.waitFor(() => expect(collectionPosts()).toHaveLength(1));
  expect(render("usr_b").find((node) => node.type === "form")?.props.hidden).toBe(true);
  reject(new Error("old request failed"));
  await pending;
  harness.fetch.mockResolvedValueOnce(reply({ authenticated: true, user: { id: "usr_b" } }));
  render("usr_b");
  for (const effect of harness.effects) effect();
  await vi.waitFor(() =>
    expect(render("usr_b").find((node) => node.type === "form")?.props.hidden).toBe(false),
  );
  expect(hasLateResultTitle(render("usr_b"))).toBe(false);
});
