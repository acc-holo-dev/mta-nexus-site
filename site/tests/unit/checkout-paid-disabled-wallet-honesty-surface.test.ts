import { describe, expect, it } from "vitest";
import { getDictionary } from "../../src/lib/i18n";

describe("checkout paid-disabled wallet honesty", () => {
  it("names the site wallet engine gate instead of a free-beta blanket for paid settle", () => {
    const en = getDictionary("en").checkout;
    const ru = getDictionary("ru").checkout;

    expect(en.paidDisabled).toMatch(/site wallet engine/i);
    expect(en.paidDisabled).toMatch(/single-server/i);
    expect(en.paidDisabled).not.toMatch(/open free beta/i);
    expect(en.paidDisabledHint).toMatch(/site wallet/i);
    expect(en.paidDisabledHint).not.toMatch(/open free beta/i);
    expect(en.paidNotAvailable).toMatch(/site wallet engine/i);
    expect(en.paidNotAvailable).not.toMatch(/open free beta/i);
    expect(en.paidCheckout).not.toMatch(/disabled$/i);

    expect(ru.paidDisabled).toMatch(/site wallet engine/i);
    expect(ru.paidDisabled).not.toMatch(/открытой бесплатной беты/i);
    expect(ru.paidDisabledHint).toMatch(/site wallet/i);
    expect(ru.paidDisabledHint).not.toMatch(/открытой бесплатной беты/i);
    expect(ru.paidNotAvailable).toMatch(/site wallet engine/i);
    expect(ru.paidNotAvailable).not.toMatch(/открытой бесплатной беты/i);
  });
});
