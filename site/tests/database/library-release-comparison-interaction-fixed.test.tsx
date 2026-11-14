import { expect, it, vi } from "vitest";
import type { Locale } from "../../src/lib/i18n";
import {
  createLibraryReleaseComparisonInteractionHelpers,
  mockReactHooks,
} from "../helpers/library-release-comparison-interaction-harness";

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
vi.mock("../../src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: h.locale }),
}));

import { LibraryReleaseComparisonSelection } from "../../src/components/library-release-comparison-selection";

const { getTarget, render, setSelection } = createLibraryReleaseComparisonInteractionHelpers(
  h,
  LibraryReleaseComparisonSelection,
);

it("does not send a command for an already fixed target", () => {
  setSelection({ revision: 4, mode: "fixed", buildId: getTarget().id });
  expect(render().some((n) => n.type === "input")).toBe(false);
  expect(render().some((n) => n.props.role === "status")).toBe(true);
  expect(h.fetch).not.toHaveBeenCalled();
});
