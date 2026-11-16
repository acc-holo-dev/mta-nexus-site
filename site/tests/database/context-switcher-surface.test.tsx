import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { ContextSwitcher } from "../../src/features/accounts/context";
import { LocaleProvider } from "../../src/features/shell/locale";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

it("marks the loading panel as busy before contexts resolve", () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise(() => {})),
  );
  const html = renderToStaticMarkup(
    <LocaleProvider locale="en">
      <ContextSwitcher />
    </LocaleProvider>,
  );
  expect(html).toContain('aria-busy="true"');
  vi.unstubAllGlobals();
});
