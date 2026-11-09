import { expect, it, vi } from "vitest";
import type { Locale } from "../../apps/web/src/lib/i18n";
import {
  ack,
  createResourceReleaseControlInteractionHelpers,
  mockReactHooks,
} from "../helpers/resource-release-control-interaction-harness";

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
vi.mock("../../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: harness.locale }),
}));

import { LibraryReleaseSelectionControls } from "../../apps/web/src/components/library-release-selection-controls";
import { getResourceReleaseControlCopy } from "../../apps/web/src/lib/resource-release-control-i18n";

const { button, click } = createResourceReleaseControlInteractionHelpers(
  harness,
  LibraryReleaseSelectionControls,
);

it.each(["en", "ru"] as const)(
  "freezes a lost request and retries it exactly in %s",
  async (locale) => {
    harness.locale = locale;
    const copy = getResourceReleaseControlCopy(locale);
    harness.fetch.mockRejectedValueOnce(new Error("lost"));
    await click(`${copy.choose}: 2`);
    const init = harness.fetch.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)["x-nexus-actor-id"]).toBe("usr_a");
    expect(button(`${copy.choose}: 3`).props.disabled).toBe(true);
    await click(`${copy.choose}: 3`); // Even a stale handler cannot replace the frozen command.
    expect(harness.fetch).toHaveBeenCalledOnce();
    harness.fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ack(init) });
    await click(copy.retrySame);
    expect(harness.fetch.mock.calls[1][1].body).toBe(init.body);
    expect(harness.refresh).toHaveBeenCalledOnce();
    expect(button(`${copy.choose}: 2`).props.disabled).toBe(true);
  },
);

it.each([429, 500, 503])(
  "retains the exact command after retryable response %s",
  async (status) => {
    harness.fetch.mockResolvedValueOnce({
      ok: false,
      status,
      json: async () => ({ code: "RATE_LIMIT_EXCEEDED" }),
    });
    await click("Use this version: 2");
    const init = harness.fetch.mock.calls[0][1] as RequestInit;
    harness.fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ack(init) });
    await click("Retry the same request");
    expect(harness.fetch.mock.calls[1][1].body).toBe(init.body);
    expect(harness.refresh).toHaveBeenCalledOnce();
  },
);
