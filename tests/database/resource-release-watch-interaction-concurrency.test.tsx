import { expect, it, vi } from "vitest";
import {
  createResourceReleaseWatchInteractionHelpers,
  mockReactHooks,
} from "../helpers/resource-release-watch-interaction-harness";

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
vi.mock("../../site/src/components/confirm-action", () => ({ confirmAction }));
vi.mock("../../site/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: h.locale }),
}));

import { ResourceReleaseWatchControl } from "../../site/src/components/resource-release-watch-control";

const helpers = createResourceReleaseWatchInteractionHelpers(
  h,
  ResourceReleaseWatchControl,
  confirmAction,
);

it("coalesces duplicate handlers and does not resend after success", async () => {
  let resolve: (value: unknown) => void = () => {};
  h.fetch.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const action = helpers.button("Notify me about new versions").props
    .onClick as () => Promise<void>;
  const first = action();
  await action();
  expect(h.fetch).toHaveBeenCalledOnce();
  resolve({ ok: true, status: 200, json: async () => helpers.ack });
  await first;
  await action();
  expect(h.fetch).toHaveBeenCalledOnce();
});

it("aborts on unmount and ignores a late success", async () => {
  let resolve: (value: unknown) => void = () => {};
  h.fetch.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const action = helpers.button("Notify me about new versions").props
    .onClick as () => Promise<void>;
  const pending = action();
  const signal = h.fetch.mock.calls[0][1].signal as AbortSignal;
  h.cleanup?.();
  expect(signal.aborted).toBe(true);
  resolve({ ok: true, status: 200, json: async () => helpers.ack });
  await pending;
  expect(h.refresh).not.toHaveBeenCalled();
});
