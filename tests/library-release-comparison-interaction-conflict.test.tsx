import { expect, it, vi } from "vitest";
import type { Locale } from "../apps/web/src/lib/i18n";
import {
  createLibraryReleaseComparisonInteractionHelpers,
  mockReactHooks,
} from "./helpers/library-release-comparison-interaction-harness";

const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanup: undefined as (() => void) | undefined,
  fetch: vi.fn(),
  refresh: vi.fn(),
  reload: vi.fn(),
  locale: "en" as Locale,
}));
vi.mock("react", (original) => mockReactHooks(h)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: h.refresh }) }));
vi.mock("../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: h.locale }),
}));

import { LibraryReleaseComparisonSelection } from "../apps/web/src/components/library-release-comparison-selection";
import { libraryReleaseComparisonCopy } from "../apps/web/src/lib/library-release-comparison-i18n";
import { flatTreeHasErrorText } from "./helpers/flatten-react-test-tree";

const { click, confirm, render } = createLibraryReleaseComparisonInteractionHelpers(
  h,
  LibraryReleaseComparisonSelection,
);

it("requires a new comparison after archive or preference conflict", async () => {
  confirm();
  h.fetch.mockResolvedValueOnce({
    ok: false,
    status: 409,
    json: async () => ({ code: "LIBRARY_RELEASE_REVIEW_CHANGED" }),
  });
  await click(libraryReleaseComparisonCopy("en").chooseCompared);
  expect(
    flatTreeHasErrorText(
      render(),
      "The reviewed archive changed. Reload the comparison before choosing it.",
    ),
  ).toBe(true);
  expect(
    render().some((n) => n.type === "button" && n.props.children === "Retry the same request"),
  ).toBe(false);
  await click("Reload current state");
  expect(h.refresh).toHaveBeenCalledOnce();
});
