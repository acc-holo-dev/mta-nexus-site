import { expect, it, vi } from "vitest";
import {
  createResourceReleaseWatchInteractionHelpers,
  mockReactHooks,
} from "./helpers/resource-release-watch-interaction-harness";

const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
  reload: vi.fn(),
  locale: "en",
  cleanup: null as (() => void) | null,
}));
vi.mock("react", async (original) => mockReactHooks(h)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: h.refresh }) }));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../site/src/components/confirm-action", () => ({ confirmAction }));
vi.mock("../site/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: h.locale }),
}));

import { ResourceReleaseWatchControl } from "../site/src/components/resource-release-watch-control";

const helpers = createResourceReleaseWatchInteractionHelpers(
  h,
  ResourceReleaseWatchControl,
  confirmAction,
);

it("does not stop notifications when confirmation is cancelled", async () => {
  helpers.setWatch({ enabled: true });
  confirmAction.mockResolvedValueOnce(false);
  const copy = helpers.copy("en");
  await helpers.click(copy.unwatch);
  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.stopConfirmTitle,
    object: copy.title,
    consequences: copy.stopConfirm,
    confirmLabel: copy.unwatch,
    cancelLabel: copy.cancel,
    closeLabel: copy.cancel,
    danger: false,
  });
  expect(h.fetch).not.toHaveBeenCalled();
  expect(helpers.button(copy.unwatch).props.disabled).toBe(false);
});

it("allows an unavailable enabled resource to be stopped", async () => {
  helpers.setAvailable(false);
  helpers.setWatch({ enabled: true });
  h.fetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({ ...helpers.ack, enabled: false }),
  });
  expect(helpers.button("Stop release notifications").props.disabled).toBe(false);
  await helpers.click("Stop release notifications");
  expect(h.refresh).toHaveBeenCalledOnce();
});
