import { expect, it, vi } from "vitest";
import {
  createCollectionReleaseWatchesInteractionHelpers,
  mockReactHooks,
} from "../helpers/collection-release-watches-interaction-harness";

const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
  reload: vi.fn(),
  locale: "en",
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("react", async (original) => mockReactHooks(h)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: h.refresh }) }));
vi.mock("../../apps/web/src/components/confirm-action", () => ({ confirmAction }));

import { ResourceReleaseWatchBatchControls } from "../../apps/web/src/components/resource-release-watch-batch-controls";
import { resourceReleaseWatchesCopy } from "../../apps/web/src/lib/resource-release-watches-i18n";

const { checks, change, click, ack, reviewed, setActiveWatchCount } =
  createCollectionReleaseWatchesInteractionHelpers(
    h,
    ResourceReleaseWatchBatchControls,
    confirmAction,
  );

it.each(["en", "ru"])(
  "freezes membership revision and exact watch enrollment after a lost response in %s",
  async (locale) => {
    h.locale = locale;
    const copy = resourceReleaseWatchesCopy(locale as "en" | "ru");
    expect(checks()).toHaveLength(2);
    await click(copy.applyEnroll);
    expect(h.fetch).not.toHaveBeenCalled();
    reviewed();
    h.fetch.mockRejectedValueOnce(new Error("lost"));
    await click(copy.applyEnroll);
    const init = h.fetch.mock.calls[0][1] as RequestInit;
    expect(h.fetch.mock.calls[0][0]).toBe("/api/library/collections/lcol_a/watches");
    expect(JSON.parse(String(init.body))).toEqual({
      expectedCollectionRevision: 3,
      items: [
        { productId: "prd_a", expectedRevision: 0 },
        { productId: "prd_b", expectedRevision: 2 },
      ],
    });
    h.fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ack(init) });
    await click(copy.retrySame);
    expect(h.fetch.mock.calls[1][1].body).toBe(init.body);
    expect(h.refresh).toHaveBeenCalledOnce();
  },
);

it("bounds checkbox choices by the remaining account-wide quota", () => {
  setActiveWatchCount(99);
  change(checks()[0], true);
  expect(checks()[1].props.disabled).toBe(true);
  expect(checks()).toHaveLength(2);
});
