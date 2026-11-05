import { expect, it, vi } from "vitest";
import {
  createLicenseControlActorInteractionHelpers,
  mockReactHooks,
} from "./helpers/license-control-actor-interaction-harness";

const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
  actor: "usr_a",
  effects: [] as (() => unknown)[],
  blur: undefined as undefined | (() => void),
  visibility: undefined as undefined | (() => void),
  owner: false,
  unbound: false,
}));
vi.mock("react", (original) => mockReactHooks(h)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: h.refresh }) }));
vi.mock("../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" }),
}));

import { LicenseControlPanel } from "../apps/web/src/components/license-control-panel";

const { render, prepare, submit } = createLicenseControlActorInteractionHelpers(
  h,
  LicenseControlPanel,
);

it("uses the original actor and rejects a late response after a different actor appears", async () => {
  let complete!: (value: unknown) => void;
  h.fetch.mockReturnValueOnce(
    new Promise((resolve) => {
      complete = resolve;
    }),
  );
  prepare();
  const pending = submit();
  expect(h.fetch.mock.calls[0][1].headers["x-nexus-actor-id"]).toBe("usr_a");
  h.actor = "usr_b";
  expect(render()).toHaveLength(0);
  complete({
    ok: true,
    status: 200,
    json: async () => ({
      actorId: "usr_a",
      license: {
        id: "lic_a",
        status: "suspended",
        serverBound: true,
        updatedAt: "2026-10-10T01:00:00.000Z",
      },
    }),
  });
  await pending;
  expect(h.refresh).not.toHaveBeenCalled();
});

it("does not confirm a valid receipt for another actor", async () => {
  h.fetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({
      actorId: "usr_b",
      license: {
        id: "lic_a",
        status: "suspended",
        serverBound: true,
        updatedAt: "2026-10-10T01:00:00.000Z",
      },
    }),
  });
  prepare();
  await submit();
  expect(h.refresh).not.toHaveBeenCalled();
});
