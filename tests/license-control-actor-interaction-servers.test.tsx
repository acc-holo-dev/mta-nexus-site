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

const { render } = createLicenseControlActorInteractionHelpers(h, LicenseControlPanel);

it("does not display a server list returned for another actor", async () => {
  h.owner = true;
  h.unbound = true;
  h.fetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({
      actorId: "usr_b",
      servers: [{ id: "srv_foreign", name: "Private B server" }],
      page: 1,
      totalPages: 1,
    }),
  });
  const button = render().find((n) => n.type === "button" && n.props.children === "Refresh");
  if (!button) throw new Error("Missing server refresh");
  (button.props.onClick as () => void)();
  await vi.waitFor(() => expect(h.fetch).toHaveBeenCalledOnce());
  await vi.waitFor(() => expect(render().some((n) => n.props.title)).toBe(true));
  expect(h.fetch.mock.calls[0][1].headers["x-nexus-actor-id"]).toBe("usr_a");
  expect(render().some((n) => n.props.children === "Private B server")).toBe(false);
});
