import { PRODUCT_TYPES } from "@nexus/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { getDictionary } from "../lib/i18n";
import { PRODUCT_PUBLISHING_KEYS } from "../lib/product-type-labels";

const state = vi.hoisted(() => ({ locale: "en" as "en" | "ru" }));
vi.mock("../components/locale-context", () => ({
  useNexusLocale: () => ({ locale: state.locale, dictionary: getDictionary(state.locale) }),
}));

import { NewResourceForm } from "./new-resource-form";

it.each(["en", "ru"] as const)("offers every supported resource type in %s", (locale) => {
  state.locale = locale;
  const html = renderToStaticMarkup(<NewResourceForm actorId="author" />);
  const select = html.match(/<select[^>]*name="type"[^>]*>(.*?)<\/select>/s)?.[1];
  expect(select).toBeDefined();
  expect(select?.match(/<option\b/g)).toHaveLength(PRODUCT_TYPES.length);
  for (const type of PRODUCT_TYPES) {
    expect(select).toContain(`value="${type}"`);
    expect(select).toContain(getDictionary(locale).publishing[PRODUCT_PUBLISHING_KEYS[type]]);
  }
});
