import { expect, it, vi } from "vitest";
import {
  createResourceReleaseWatchBatchInteractionHelpers,
  mockReactHooks,
} from "../helpers/resource-release-watch-batch-interaction-harness";

const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
  reload: vi.fn(),
  locale: "en",
  cleanup: null as (() => void) | null,
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("react", async (original) => mockReactHooks(h)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: h.refresh }) }));
vi.mock("../../apps/web/src/components/confirm-action", () => ({ confirmAction }));

import { ResourceReleaseWatchBatchControls } from "../../apps/web/src/components/resource-release-watch-batch-controls";

const { button, ack, reviewed } = createResourceReleaseWatchBatchInteractionHelpers(
  h,
  ResourceReleaseWatchBatchControls,
  confirmAction,
);

it("coalesces stale duplicate click handlers while a request is in flight", async () => {
  reviewed();
  let resolve: (value: unknown) => void = () => {};
  h.fetch.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const action = button("Stop selected watches").props.onClick as () => void;
  action();
  await new Promise((r) => setTimeout(r, 0));
  action();
  expect(h.fetch).toHaveBeenCalledOnce();
  const init = h.fetch.mock.calls[0][1] as RequestInit;
  resolve({ ok: true, status: 200, json: async () => ack(init) });
  await new Promise((r) => setTimeout(r, 0));
  expect(h.refresh).toHaveBeenCalledOnce();
});

it("aborts a group command on unmount and ignores the late acknowledgement", async () => {
  reviewed();
  let resolve: (value: unknown) => void = () => {};
  h.fetch.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  (button("Stop selected watches").props.onClick as () => void)();
  await new Promise((r) => setTimeout(r, 0));
  const init = h.fetch.mock.calls[0][1] as RequestInit;
  h.cleanup?.();
  expect(init.signal?.aborted).toBe(true);
  resolve({ ok: true, status: 200, json: async () => ack(init) });
  await new Promise((r) => setTimeout(r, 0));
  expect(h.refresh).not.toHaveBeenCalled();
});
