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
} from "../apps/web/src/components/storage-maintenance-controls";

const { renderDiscovery, click } = createStorageMaintenanceActorInteractionHelpers(
  h,
  StorageCleanupControls,
  StorageDiscoveryControls,
);

it("does not show namespaces returned for another administrator", async () => {
  h.fetch.mockResolvedValueOnce(
    reply({ actorId: "usr_b", owners: ["private_owner"], nextOffset: null, limited: false }),
  );
  click(renderDiscovery(), "List namespaces");
  await vi.waitFor(() => expect(renderDiscovery().some((n) => n.props.title)).toBe(true));
  expect(h.fetch.mock.calls[0][1].headers["x-nexus-actor-id"]).toBe("usr_a");
  expect(renderDiscovery().some((n) => n.props.children === "private_owner")).toBe(false);
});

it("ignores a delayed discovery response after the administrator changes", async () => {
  let complete!: (value: Response) => void;
  h.fetch.mockReturnValueOnce(
    new Promise<Response>((resolve) => {
      complete = resolve;
    }),
  );
  const form = renderDiscovery().find((n) => n.type === "form");
  if (!form) throw Error("Missing discovery form");
  (form.props.onSubmit as (event: unknown) => void)({ preventDefault() {} });
  expect(h.fetch.mock.calls[0][1].headers["x-nexus-actor-id"]).toBe("usr_a");
  h.actor = "usr_b";
  expect(renderDiscovery()).toHaveLength(0);
  complete(reply({ actorId: "usr_a", observed: 1, skipped: 0, nextOffset: null, limited: false }));
  await Promise.resolve();
  await Promise.resolve();
  expect(h.refresh).not.toHaveBeenCalled();
});
