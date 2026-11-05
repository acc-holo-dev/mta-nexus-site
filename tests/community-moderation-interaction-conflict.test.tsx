import { expect, it, vi } from "vitest";
import {
  ack,
  createCommunityModerationInteractionHelpers,
  mockReactHooks,
  previous,
  response,
} from "./helpers/community-moderation-interaction-harness";
import { flatTreeHasErrorText } from "./helpers/flatten-react-test-tree";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as (() => void)[],
  refresh: vi.fn(),
  fetch: vi.fn(),
  reload: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../apps/web/src/components/confirm-action", () => ({
  confirmAction,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));
vi.mock("../apps/web/src/components/locale-context", async () => {
  const { getDictionary } = await import("../apps/web/src/lib/i18n");
  return {
    useNexusLocale: () => ({ locale: "en", dictionary: getDictionary("en") }),
  };
});

import { ContentModerationControls } from "../apps/web/src/components/content-moderation-controls";

const { render, click, ready } = createCommunityModerationInteractionHelpers(
  harness,
  ContentModerationControls,
  confirmAction,
);

it.each([
  [response({ ...ack, id: "foreign" }), "could not be confirmed"],
  [response({ ...ack, updatedAt: previous }), "could not be confirmed"],
  [response({ code: "CONTENT_STATE_CHANGED" }, 409), "publication changed"],
  [new Response("malformed", { status: 200 }), "could not be confirmed"],
])("blocks uncertain/conflicting replies until saved state is reloaded", async (reply, message) => {
  harness.fetch.mockResolvedValueOnce(reply);
  click(ready(), "Publish");
  await vi.waitFor(() => expect(render().some((node) => node.props.role === "alert")).toBe(true));
  const nodes = render();
  expect(flatTreeHasErrorText(nodes, message)).toBe(true);
  expect(harness.refresh).not.toHaveBeenCalled();
  click(nodes, "Archive");
  expect(harness.fetch).toHaveBeenCalledTimes(1);
  click(nodes, "Reload saved version");
  expect(harness.refresh).toHaveBeenCalledTimes(1);
  expect(harness.reload).not.toHaveBeenCalled();
});
