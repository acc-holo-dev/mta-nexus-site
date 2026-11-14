import { expect, it, vi } from "vitest";
import {
  createLicenseControlActorInteractionHelpers,
  mockReactHooks,
} from "../helpers/license-control-actor-interaction-harness";

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
vi.mock("../../src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" }),
}));

import { LicenseControlPanel } from "../../src/components/license-control-panel";

const { render, prepare, submit } = createLicenseControlActorInteractionHelpers(
  h,
  LicenseControlPanel,
);

it("conceals a displayed owner runtime token when the document becomes hidden", async () => {
  h.owner = true;
  render();
  for (const effect of h.effects) effect();
  const updatedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 86_400_000).toISOString();
  const token = `nxlt_${"A".repeat(43)}`;
  h.fetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({
      actorId: "usr_a",
      license: { id: "lic_a", status: "active", serverBound: true, updatedAt },
      token: { value: token, expiresAt },
    }),
  });
  prepare();
  await submit();
  expect(render().some((n) => n.type === "input" && n.props.value === token)).toBe(true);
  if (!h.visibility) throw new Error("Missing visibility handler");
  h.visibility();
  expect(render().some((n) => n.type === "input" && n.props.value === token)).toBe(false);
});

it("does not show a late owner runtime token after another identity renders", async () => {
  h.owner = true;
  let complete!: (value: unknown) => void;
  h.fetch.mockReturnValueOnce(
    new Promise((resolve) => {
      complete = resolve;
    }),
  );
  prepare();
  const pending = submit();
  h.actor = "usr_b";
  render();
  complete({
    ok: true,
    status: 200,
    json: async () => ({
      actorId: "usr_a",
      license: {
        id: "lic_a",
        status: "active",
        serverBound: true,
        updatedAt: new Date().toISOString(),
      },
      token: {
        value: `nxlt_${"A".repeat(43)}`,
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      },
    }),
  });
  await pending;
  expect(render().some((n) => n.type === "input" && n.props.type === "password")).toBe(false);
});
