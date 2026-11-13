import { expect, it, vi } from "vitest";
import type { Locale } from "../../site/src/lib/i18n";
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
vi.mock("../../site/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: h.locale }),
}));

import { LibraryReleaseComparisonSelection } from "../../site/src/components/library-release-comparison-selection";
import { libraryReleaseComparisonCopy } from "../../site/src/lib/library-release-comparison-i18n";
import { getResourceReleaseControlCopy } from "../../site/src/lib/resource-release-control-i18n";

const { button, click, confirm, confirmation, render, setConfirmation, getTarget } =
  createLibraryReleaseComparisonInteractionHelpers(h, LibraryReleaseComparisonSelection);

it.each(["en", "ru"] as const)(
  "requires explicit confirmation and freezes the exact reviewed archive in %s",
  async (locale) => {
    h.locale = locale;
    const copy = libraryReleaseComparisonCopy(locale);
    const control = getResourceReleaseControlCopy(locale);
    expect(button(copy.chooseCompared).props.disabled).toBe(true);
    await click(copy.chooseCompared);
    expect(h.fetch).not.toHaveBeenCalled();
    confirm();
    expect(render().find((n) => n.type === "input")?.props.className).toContain(
      "focus-visible:ring-[color:var(--nexus-accent)]",
    );
    h.fetch.mockRejectedValueOnce(new Error("lost"));
    await click(copy.chooseCompared);
    const init = h.fetch.mock.calls[0][1] as RequestInit;
    const command = JSON.parse(String(init.body));
    expect(command).toEqual({
      mode: "fixed",
      buildId: "bld_b",
      expectedRevision: 3,
      reviewedArtifact: { sha256Hash: getTarget().sha256Hash, fileSizeBytes: 100 },
    });
    expect(render().find((n) => n.type === "input")?.props.disabled).toBe(true);
    h.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        productId: "prd_a",
        selection: {
          revision: 4,
          mode: "fixed",
          buildId: "bld_b",
          updatedAt: "2026-10-12T00:00:00.000Z",
        },
      }),
    });
    await click(control.retrySame);
    expect(h.fetch.mock.calls[1][1].body).toBe(init.body);
    expect(h.refresh).toHaveBeenCalledOnce();
  },
);

it("does not choose the compared archive when confirmation is cancelled", async () => {
  const copy = libraryReleaseComparisonCopy("en");
  button(copy.chooseCompared);
  const slotsBefore = structuredClone(h.slots);
  confirm();
  expect(button(copy.chooseCompared).props.disabled).toBe(false);
  setConfirmation(false);
  expect(confirmation().props.checked).toBe(false);
  expect(button(copy.chooseCompared).props.disabled).toBe(true);
  await click(copy.chooseCompared);
  expect(h.fetch).not.toHaveBeenCalled();
  expect(h.refresh).not.toHaveBeenCalled();
  expect(h.reload).not.toHaveBeenCalled();
  expect(h.slots).toEqual(slotsBefore);
});
