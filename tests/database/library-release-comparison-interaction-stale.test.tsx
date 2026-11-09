import { expect, it, vi } from "vitest";
import type { Locale } from "../../apps/web/src/lib/i18n";
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
vi.mock("../../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: h.locale }),
}));

import { LibraryReleaseComparisonSelection } from "../../apps/web/src/components/library-release-comparison-selection";
import { libraryReleaseComparisonCopy } from "../../apps/web/src/lib/library-release-comparison-i18n";

const { button, click, confirm, mutateSelection, mutateTarget, setSelection, setTarget } =
  createLibraryReleaseComparisonInteractionHelpers(h, LibraryReleaseComparisonSelection);

it("requires renewed acknowledgement when comparison metadata changes and ignores the old handler", async () => {
  confirm();
  const stale = button(libraryReleaseComparisonCopy("en").chooseCompared).props
    .onClick as () => void;
  setTarget((prev) => ({ ...prev, sha256Hash: "c".repeat(64), fileSizeBytes: 101 }));
  setSelection((prev) => ({ ...prev, revision: 8 }));
  expect(button(libraryReleaseComparisonCopy("en").chooseCompared).props.disabled).toBe(true);
  stale();
  expect(h.fetch).not.toHaveBeenCalled();
  confirm();
  h.fetch.mockRejectedValueOnce(Error("unknown response"));
  await click(libraryReleaseComparisonCopy("en").chooseCompared);
  expect(JSON.parse(String(h.fetch.mock.calls[0]?.[1].body))).toMatchObject({
    expectedRevision: 8,
    reviewedArtifact: { sha256Hash: "c".repeat(64), fileSizeBytes: 101 },
  });
});

it("captures reviewed values instead of following later mutation of caller-owned objects", async () => {
  confirm();
  const apply = button(libraryReleaseComparisonCopy("en").chooseCompared).props
    .onClick as () => void;
  mutateTarget({ sha256Hash: "c".repeat(64) });
  mutateSelection({ revision: 8 });
  h.fetch.mockRejectedValueOnce(Error("unknown response"));
  apply();
  await new Promise((r) => setTimeout(r, 0));
  expect(JSON.parse(String(h.fetch.mock.calls[0]?.[1].body))).toMatchObject({
    expectedRevision: 3,
    reviewedArtifact: { sha256Hash: "b".repeat(64), fileSizeBytes: 100 },
  });
});
