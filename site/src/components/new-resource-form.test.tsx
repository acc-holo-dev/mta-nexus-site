import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PRODUCT_TYPES } from "@nexus/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { getDictionary } from "../lib/i18n";
import { PRODUCT_PUBLISHING_KEYS } from "../lib/product-type-labels";

const state = vi.hoisted(() => ({ locale: "en" as "en" | "ru" }));
vi.mock("./locale-context", () => ({
  useNexusLocale: () => ({ locale: state.locale, dictionary: getDictionary(state.locale) }),
}));

import { NewResourceForm } from "./new-resource-form";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "new-resource-form.tsx"),
  "utf8",
);

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

it.each(["en", "ru"] as const)("renders localized build constraints in %s", (locale) => {
  state.locale = locale;
  const html = renderToStaticMarkup(<NewResourceForm actorId="author" />);
  const copy = getDictionary(locale).publishing;

  expect(html).toContain('pattern="v?[0-9]+\\.[0-9]+(\\.[0-9]+)?(-[a-zA-Z0-9.]+)?"');
  expect(html).toContain('pattern="1\\.[0-9]+(\\.[0-9]+)?"');
  expect(html).toContain('accept=".zip,.rar,.7z,.lua"');
  expect(html).toContain(copy.buildFileRequirements.replace("{maxFileSize}", "64"));
  expect(html).toContain("min-h-11");
  expect(html).toContain("min-w-0");
  expect(html).toContain("overflow-x-clip");
});

it("locks new resource form honesty to ErrorState without ad-hoc alerts", () => {
  expect(source).toContain("ErrorState");
  expect(source).toContain("The submission may have completed");
  expect(source).not.toContain('role="alert"');
});

it("locks new resource native selects to fieldControlClass without h-10 chrome", () => {
  expect(source).toContain("fieldControlClass");
  expect(source).toContain('className: "min-h-11"');
  expect(source).not.toContain("h-10");
  expect(source).not.toMatch(/const controlClass\s*=/u);
});
