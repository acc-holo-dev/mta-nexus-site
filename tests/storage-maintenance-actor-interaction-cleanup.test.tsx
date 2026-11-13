import { expect, it, vi } from "vitest";
import {
  createStorageMaintenanceActorInteractionHelpers,
  mockReactHooks,
  reply,
} from "./helpers/storage-maintenance-actor-interaction-harness";

const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
  actor: "usr_a",
}));
vi.mock("react", (original) => mockReactHooks(h)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: h.refresh }) }));

import {
  StorageCleanupControls,
  StorageDiscoveryControls,
} from "../site/src/components/storage-maintenance-controls";

const { renderCleanup, check, click } = createStorageMaintenanceActorInteractionHelpers(
  h,
  StorageCleanupControls,
  StorageDiscoveryControls,
);

it("blocks cleanup after an unconfirmed response and binds the original actor", async () => {
  h.fetch.mockResolvedValueOnce(reply({ actorId: "usr_b", state: "deleted" }));
  check();
  click(renderCleanup(), "Delete this object");
  await vi.waitFor(() => expect(renderCleanup().some((n) => n.props.title)).toBe(true));
  expect(h.fetch.mock.calls[0][1].headers["x-nexus-actor-id"]).toBe("usr_a");
  expect(h.refresh).not.toHaveBeenCalled();
  expect(
    renderCleanup().find((n) => n.type === "button" && n.props.children === "Delete this object")
      ?.props.disabled,
  ).toBe(true);
});

it("ignores a delayed cleanup response after the administrator changes", async () => {
  let complete!: (value: Response) => void;
  h.fetch.mockReturnValueOnce(
    new Promise<Response>((resolve) => {
      complete = resolve;
    }),
  );
  check();
  click(renderCleanup(), "Delete this object");
  h.actor = "usr_b";
  expect(renderCleanup()).toHaveLength(0);
  complete(reply({ actorId: "usr_a", state: "deleted" }));
  await Promise.resolve();
  await Promise.resolve();
  expect(h.refresh).not.toHaveBeenCalled();
});
