import { expect, it, vi } from "vitest";
import {
  ack,
  createCommunityModerationInteractionHelpers,
  mockReactHooks,
  response,
} from "../helpers/community-moderation-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as (() => void)[],
  refresh: vi.fn(),
  fetch: vi.fn(),
  reload: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../../src/components/confirm-action", () => ({
  confirmAction,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));
vi.mock("../../src/components/locale-context", async () => {
  const { getDictionary } = await import("../../src/lib/i18n");
  return {
    useNexusLocale: () => ({ locale: "en", dictionary: getDictionary("en") }),
  };
});

import { ContentModerationControls } from "../../src/components/content-moderation-controls";

const { render, click, ready } = createCommunityModerationInteractionHelpers(
  harness,
  ContentModerationControls,
  confirmAction,
);

it("guards duplicate clicks while the request is pending and lets cancellation leave the controls ready", async () => {
  confirmAction.mockResolvedValueOnce(false);
  const nodes = ready();
  click(nodes, "Publish");
  await vi.waitFor(() => expect(confirmAction).toHaveBeenCalledTimes(1));
  expect(harness.fetch).not.toHaveBeenCalled();
  let complete!: (value: Response) => void;
  harness.fetch.mockReturnValueOnce(
    new Promise<Response>((resolve) => {
      complete = resolve;
    }),
  );
  click(nodes, "Publish");
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledTimes(1));
  click(nodes, "Publish");
  expect(harness.fetch).toHaveBeenCalledTimes(1);
  expect(render()[0].props["aria-busy"]).toBe(true);
  complete(response(ack));
  await vi.waitFor(() => expect(harness.refresh).toHaveBeenCalledTimes(1));
});
