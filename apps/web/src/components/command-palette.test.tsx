import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "./locale-context";
import { CommandPalette } from "./command-palette";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
it.each(["en", "ru"] as const)(
  "exposes a localized native dialog and connected combobox options in %s",
  (locale) => {
    const html = renderToStaticMarkup(
      <LocaleProvider locale={locale}>
        <CommandPalette isOpen onClose={() => {}} />
      </LocaleProvider>,
    );
    expect(html).toContain("<dialog");
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('role="combobox"');
    expect(html).toContain('role="listbox"');
    expect(html).toContain('role="option"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain("aria-activedescendant=");
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain(locale === "en" ? "Command palette" : "Палитра команд");
  },
);
it("renders no closed palette or hidden focus targets", () => {
  expect(
    renderToStaticMarkup(
      <LocaleProvider locale="en">
        <CommandPalette isOpen={false} onClose={() => {}} />
      </LocaleProvider>,
    ),
  ).toBe("");
});
