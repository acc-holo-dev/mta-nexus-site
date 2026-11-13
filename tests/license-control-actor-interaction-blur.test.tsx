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
vi.mock("../site/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" }),
}));

import { LicenseControlPanel } from "../site/src/components/license-control-panel";

const { render, prepare, submit } = createLicenseControlActorInteractionHelpers(
  h,
  LicenseControlPanel,
);

it("conceals an in-flight result on blur and asks to refresh the uncertain state", async () => {
  let complete!: (value: unknown) => void;
  h.fetch.mockReturnValueOnce(
    new Promise((resolve) => {
      complete = resolve;
    }),
  );
  render();
  for (const effect of h.effects) effect();
  prepare();
  const pending = submit();
  if (!h.blur) throw new Error("Missing blur handler");
  h.blur();
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
  expect(
    render().some(
      (n) => n.props.title === "The change could not be confirmed. Refresh before trying again.",
    ),
  ).toBe(true);
});
