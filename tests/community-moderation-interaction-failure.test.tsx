import { expect, it, vi } from "vitest";
import {
  ack,
  createCommunityModerationInteractionHelpers,
  mockReactHooks,
} from "./helpers/community-moderation-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as (() => void)[],
  refresh: vi.fn(),
  fetch: vi.fn(),
  reload: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../site/src/components/confirm-action", () => ({
  confirmAction,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));
vi.mock("../site/src/components/locale-context", async () => {
  const { getDictionary } = await import("../site/src/lib/i18n");
  return {
    useNexusLocale: () => ({ locale: "en", dictionary: getDictionary("en") }),
  };
});

import { ContentModerationControls } from "../site/src/components/content-moderation-controls";

const { render, button, click, ready } = createCommunityModerationInteractionHelpers(
  harness,
  ContentModerationControls,
  confirmAction,
);

it("blocks network failures without success or refresh", async () => {
  harness.fetch.mockRejectedValueOnce(new Error("offline"));
  click(ready(), "Publish");
  await vi.waitFor(() => expect(render().some((node) => node.props.role === "alert")).toBe(true));
  expect(harness.refresh).not.toHaveBeenCalled();
  expect(button(render(), "Publish").props.disabled).toBe(true);
});

it("aborts an unmounted request and ignores its eventual acknowledgement", async () => {
  let complete!: (value: Response) => void;
  harness.fetch.mockReturnValueOnce(
    new Promise<Response>((resolve) => {
      complete = resolve;
    }),
  );
  click(ready(), "Publish");
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledTimes(1));
  for (const cleanup of harness.cleanups) cleanup();
  expect(harness.fetch.mock.calls[0][1].signal.aborted).toBe(true);
  const json = vi.fn().mockResolvedValue(ack);
  complete({ ok: true, json } as unknown as Response);
  await vi.waitFor(() => expect(json).toHaveBeenCalledTimes(1));
  await Promise.resolve();
  expect(harness.refresh).not.toHaveBeenCalled();
});
