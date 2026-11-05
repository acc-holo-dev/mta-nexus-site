import { expect, it, vi } from "vitest";
import type { Locale } from "../apps/web/src/lib/i18n";
import {
  ack,
  createResourceReleaseControlInteractionHelpers,
  mockReactHooks,
} from "./helpers/resource-release-control-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanup: undefined as (() => void) | undefined,
  fetch: vi.fn(),
  refresh: vi.fn(),
  reload: vi.fn(),
  locale: "en" as Locale,
  productId: "prd_a",
  actorId: "usr_a",
  revision: 3,
  artifactValid: true,
  uiUpdates: 0,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));
vi.mock("../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: harness.locale }),
}));

import { LibraryReleaseSelectionControls } from "../apps/web/src/components/library-release-selection-controls";

const { render, button, click } = createResourceReleaseControlInteractionHelpers(
  harness,
  LibraryReleaseSelectionControls,
);

it("retries the captured route and archive after resource and revision props change", async () => {
  harness.fetch.mockRejectedValueOnce(Error("lost response"));
  await click("Use this version: 2");
  const first = harness.fetch.mock.calls[0];
  const init = first?.[1] as RequestInit;
  expect(JSON.parse(String(init.body)).reviewedArtifact).toEqual({
    sha256Hash: "a".repeat(64),
    fileSizeBytes: 100,
  });
  harness.productId = "prd_other";
  harness.revision = 99;
  expect(render().some((n) => n.props.href === "/workspace/library/prd_a/versions")).toBe(true);
  harness.fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ack(init) });
  await click("Retry the same request");
  expect(harness.fetch.mock.calls[1]?.[0]).toBe(first?.[0]);
  expect(harness.fetch.mock.calls[1]?.[1].body).toBe(init.body);
  expect(harness.refresh).toHaveBeenCalledOnce();
});

it("ignores a retained handler for a different resource before any send", async () => {
  const stale = button("Use this version: 2").props.onClick as () => void;
  harness.productId = "prd_other";
  render();
  stale();
  await new Promise((r) => setTimeout(r, 0));
  expect(harness.fetch).not.toHaveBeenCalled();
});

it.each([200, 409])(
  "prevents a stale retry handler from sending again after settlement %s",
  async (status) => {
    harness.fetch.mockRejectedValueOnce(Error("lost response"));
    await click("Use this version: 2");
    const retry = button("Retry the same request").props.onClick as () => void;
    const init = harness.fetch.mock.calls[0]?.[1] as RequestInit;
    harness.fetch.mockResolvedValueOnce({
      ok: status === 200,
      status,
      json: async () => ack(init),
    });
    retry();
    await new Promise((r) => setTimeout(r, 0));
    retry();
    await new Promise((r) => setTimeout(r, 0));
    expect(harness.fetch).toHaveBeenCalledTimes(2);
    expect(harness.refresh).toHaveBeenCalledTimes(status === 200 ? 1 : 0);
  },
);
