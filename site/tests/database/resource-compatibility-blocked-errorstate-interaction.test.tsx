import { expect, it, vi } from "vitest";
import { findTestButton } from "../helpers/flatten-react-test-tree";
import {
  createResourceCompatibilityDraftInteractionHelpers,
  mockReactHooks,
  suspended,
} from "../helpers/resource-compatibility-draft-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
  locale: "en" as "en" | "ru",
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));
vi.mock("../../src/features/shell/locale", async () => {
  const { getDictionary } = await import("../../src/lib/i18n");
  return {
    useNexusLocale: () => ({
      locale: harness.locale,
      dictionary: getDictionary(harness.locale),
    }),
  };
});

import { getDictionary } from "../../src/lib/i18n";
import { ResourceCompatibilityForm } from "../../src/features/resources/components/resource-compatibility-form";
import { getResourceManagementCopy } from "../../src/features/resources/resource-management-i18n";
import { getResourcePublisherCopy } from "../../src/features/resources/resource-publisher-i18n";

const { render } = createResourceCompatibilityDraftInteractionHelpers(
  harness,
  ResourceCompatibilityForm,
);

it.each(["en", "ru"] as const)(
  "routes suspended product notice through ErrorState without retry in %s",
  (locale) => {
    harness.locale = locale;
    const copy = getResourceManagementCopy(locale);
    const readonly = getResourcePublisherCopy(locale).readonly;
    const formErrorHint = getDictionary(locale).errors.formErrorHint;
    const nodes = render(suspended);
    expect(nodes.some((node) => node.props.title === readonly)).toBe(true);
    expect(
      nodes.some((node) => node.props.id === "resource-compatibility-suspended-readonly"),
    ).toBe(true);
    expect(
      nodes.some(
        (node) =>
          node.props.id === "resource-compatibility-suspended-readonly" &&
          node.props.description === formErrorHint,
      ),
    ).toBe(true);
    expect(
      nodes.some(
        (node) =>
          node.props.id === "resource-compatibility-suspended-readonly" &&
          node.props.action != null,
      ),
    ).toBe(false);
    expect(findTestButton(nodes, copy.save).props.disabled).toBe(true);
    expect(nodes.some((node) => node.type === "p" && node.props.className === "text-warning")).toBe(
      false,
    );
  },
);
