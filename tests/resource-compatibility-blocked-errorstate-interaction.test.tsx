import { expect, it, vi } from "vitest";
import { findTestButton } from "./helpers/flatten-react-test-tree";
import {
  createResourceCompatibilityDraftInteractionHelpers,
  mockReactHooks,
  suspended,
} from "./helpers/resource-compatibility-draft-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
  locale: "en" as "en" | "ru",
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));
vi.mock("../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: harness.locale }),
}));

import { ResourceCompatibilityForm } from "../apps/web/src/components/resource-compatibility-form";
import { getResourceManagementCopy } from "../apps/web/src/lib/resource-management-i18n";

const { render } = createResourceCompatibilityDraftInteractionHelpers(
  harness,
  ResourceCompatibilityForm,
);

it.each(["en", "ru"] as const)(
  "routes suspended product notice through ErrorState without retry in %s",
  (locale) => {
    harness.locale = locale;
    const copy = getResourceManagementCopy(locale);
    const nodes = render(suspended);
    expect(nodes.some((node) => node.props.title === copy.errors.PRODUCT_STATE_CHANGED)).toBe(true);
    expect(
      nodes.some(
        (node) =>
          node.props.title === copy.errors.PRODUCT_STATE_CHANGED &&
          node.props.description !== undefined,
      ),
    ).toBe(false);
    expect(
      nodes.some(
        (node) =>
          node.props.title === copy.errors.PRODUCT_STATE_CHANGED && node.props.action != null,
      ),
    ).toBe(false);
    expect(findTestButton(nodes, copy.save).props.disabled).toBe(true);
    expect(nodes.some((node) => node.type === "p" && node.props.className === "text-warning")).toBe(
      false,
    );
  },
);
