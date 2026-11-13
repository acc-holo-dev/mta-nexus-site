import { expect, it, vi } from "vitest";
import { flatTreeHasErrorText } from "../helpers/flatten-react-test-tree";
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
vi.mock("../../src/components/confirm-action", () => ({ confirmAction }));

import { ResourceReleaseWatchBatchControls } from "../../src/components/resource-release-watch-batch-controls";
import { resourceReleaseWatchesCopy } from "../../src/lib/resource-release-watches-i18n";

const { render, button, click, ack, reviewed } = createResourceReleaseWatchBatchInteractionHelpers(
  h,
  ResourceReleaseWatchBatchControls,
  confirmAction,
);

it.each(["en", "ru"])(
  "requires selection and retries exactly the frozen sorted batch in %s",
  async (locale) => {
    h.locale = locale;
    const copy = resourceReleaseWatchesCopy(locale as "en" | "ru");
    await click(copy.applyBatch);
    expect(h.fetch).not.toHaveBeenCalled();
    expect(confirmAction).not.toHaveBeenCalled();
    reviewed();
    h.fetch.mockRejectedValueOnce(new Error("lost"));
    await click(copy.applyBatch);
    const init = h.fetch.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body)).items).toEqual([
      { productId: "prd_a", expectedRevision: 1 },
      { productId: "prd_b", expectedRevision: 3 },
    ]);
    expect(render().find((n) => n.type === "fieldset")?.props.disabled).toBe(true);
    h.fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ack(init) });
    await click(copy.retrySame);
    expect(confirmAction).toHaveBeenCalledOnce();
    expect(h.fetch.mock.calls[1][1].body).toBe(init.body);
    expect(h.refresh).toHaveBeenCalledOnce();
  },
);

it("does not confirm partial or foreign acknowledgements", async () => {
  reviewed();
  h.fetch.mockImplementationOnce(async (_url: string, init: RequestInit) => {
    const body = ack(init);
    body.items[0].productId = "prd_foreign";
    return { ok: true, status: 200, json: async () => body };
  });
  await click("Stop selected watches");
  expect(h.refresh).not.toHaveBeenCalled();
  expect(flatTreeHasErrorText(render(), resourceReleaseWatchesCopy("en").failed)).toBe(true);
});

it("requires reload after a revision conflict", async () => {
  reviewed();
  h.fetch.mockResolvedValueOnce({
    ok: false,
    status: 409,
    json: async () => ({ code: "RELEASE_WATCH_BATCH_CONFLICT" }),
  });
  await click("Stop selected watches");
  expect(
    render().some((n) => n.type === "button" && n.props.children === "Retry the same request"),
  ).toBe(false);
  await click("Reload current state");
  expect(h.refresh).toHaveBeenCalledOnce();
  expect(button("Reload current state").props.disabled).toBe(false);
});
