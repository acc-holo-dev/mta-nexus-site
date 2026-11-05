import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { followCopy } from "../apps/web/src/lib/follow-workspace-copy";
import {
  createSavedFollowsInteractionHelpers,
  mockReactHooks,
} from "./helpers/saved-follows-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as (() => void)[],
  fetch: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../apps/web/src/components/confirm-action", () => ({
  confirmAction,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));

import { FollowWorkspace } from "../apps/web/src/components/follow-workspace";

createSavedFollowsInteractionHelpers(harness, FollowWorkspace, confirmAction);

it.each(["en", "ru"] as const)(
  "renders EmptyState title and description for an empty saved list in %s",
  (locale) => {
    harness.cursor = 0;
    harness.slots = [];
    const copy = followCopy(locale);
    const html = renderToStaticMarkup(
      FollowWorkspace({
        actorId: "usr_1",
        initial: { items: [], hasMore: false, nextCursor: null },
        query: "",
        locale,
      }),
    );
    expect(html).toContain(copy.empty);
    expect(html).toContain(copy.emptyHint);
    expect(html).toContain(copy.discover);
    expect(html).toContain("overflow-x-clip");
    expect(html).toContain("min-h-11");
  },
);

it.each(["en", "ru"] as const)(
  "renders ErrorState retry when the saved workspace has no initial page in %s",
  (locale) => {
    harness.cursor = 0;
    harness.slots = [];
    const copy = followCopy(locale);
    const html = renderToStaticMarkup(
      FollowWorkspace({ actorId: "usr_1", initial: null, query: "", locale }),
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain(copy.pageError);
    expect(html).toContain(copy.retry);
    expect(html).toContain("overflow-x-clip");
  },
);
