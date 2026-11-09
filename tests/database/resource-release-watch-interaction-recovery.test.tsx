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
vi.mock("../../apps/web/src/components/confirm-action", () => ({ confirmAction }));
vi.mock("../../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: h.locale }),
}));

import { ResourceReleaseWatchControl } from "../../apps/web/src/components/resource-release-watch-control";

const helpers = createResourceReleaseWatchInteractionHelpers(
  h,
  ResourceReleaseWatchControl,
  confirmAction,
);

it.each(["en", "ru"])(
  "freezes the original resource and revision for a lost-response retry in %s",
  async (locale) => {
    h.locale = locale;
    const copy = helpers.copy(locale as "en" | "ru");
    h.fetch.mockRejectedValueOnce(new Error("lost"));
    await helpers.click(copy.watch);
    const [url, init] = h.fetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ enabled: true, expectedRevision: 2 });
    helpers.setWatch({ productId: "prd_other", revision: 8 });
    h.fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => helpers.ack });
    await helpers.click(copy.retrySame);
    expect(h.fetch.mock.calls[1][0]).toBe(url);
    expect(h.fetch.mock.calls[1][1].body).toBe(init.body);
    expect(h.refresh).toHaveBeenCalledOnce();
  },
);

it.each([401, 404, 409])("requires reload after a definitive error %s", async (status) => {
  h.fetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => ({ code: "RELEASE_WATCH_CONFLICT" }),
  });
  const stale = helpers.button("Notify me about new versions").props.onClick as () => Promise<void>;
  await stale();
  await stale();
  expect(h.fetch).toHaveBeenCalledOnce();
  expect(
    helpers
      .render()
      .some((n) => n.type === "button" && n.props.children === "Retry the same request"),
  ).toBe(false);
  await helpers.click("Reload current state");
  expect(h.refresh).toHaveBeenCalledOnce();
  expect(h.reload).not.toHaveBeenCalled();
});

it.each([
  { ...helpers.ack, productId: "prd_other" },
  { ...helpers.ack, enabled: false },
  { ...helpers.ack, revision: 4 },
  { ...helpers.ack, updatedAt: "invalid" },
  { ...helpers.ack, updatedAt: "2026-10-12T00:00:00.000Z" },
  { ...helpers.ack, updatedAt: "2027" },
])("keeps an invalid acknowledgement unconfirmed", async (body) => {
  h.fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => body });
  await helpers.click("Notify me about new versions");
  expect(h.refresh).not.toHaveBeenCalled();
  expect(helpers.button("Retry the same request").props.disabled).toBe(false);
});
