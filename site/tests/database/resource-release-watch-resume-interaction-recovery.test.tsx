import { expect, it, vi } from "vitest";
import {
  createResourceReleaseWatchResumeInteractionHelpers,
  mockReactHooks,
} from "../helpers/resource-release-watch-resume-interaction-harness";

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
vi.mock("../../src/components/confirm-action", () => ({ confirmAction }));

import { ResourceReleaseWatchBatchControls } from "../../src/features/resources/components/resource-release-watch-batch-controls";
import { resourceReleaseWatchesCopy } from "../../src/lib/resource-release-watches-i18n";

const helpers = createResourceReleaseWatchResumeInteractionHelpers(
  h,
  ResourceReleaseWatchBatchControls,
  confirmAction,
);

it.each(["en", "ru"])(
  "reviews existing watches and freezes the same resume request after response loss in %s",
  async (locale) => {
    h.locale = locale;
    const copy = resourceReleaseWatchesCopy(locale as "en" | "ru");
    expect(helpers.checks()).toHaveLength(2);
    await helpers.click(copy.applyResume);
    expect(h.fetch).not.toHaveBeenCalled();
    helpers.reviewed();
    h.fetch.mockRejectedValueOnce(new Error("lost"));
    await helpers.click(copy.applyResume);
    const [url, init] = h.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/library/watches/resume");
    expect(JSON.parse(String(init.body))).toEqual({
      items: [
        { productId: "prd_a", expectedRevision: 1 },
        { productId: "prd_b", expectedRevision: 2 },
      ],
    });
    h.fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => helpers.ack(init) });
    await helpers.click(copy.retrySame);
    expect(h.fetch.mock.calls[1][1].body).toBe(init.body);
    expect(h.refresh).toHaveBeenCalledOnce();
  },
);
