import { expect, it } from "vitest";
import { LICENSE_MODEL_VALUES, licenseModelLabel } from "../../src/lib/license-model-i18n";
import { orderTermsLicenseLabel } from "../../src/lib/order-terms-i18n";

const SUCCESSISH = [
  "open source",
  "opensource",
  "closed source",
  "success",
  "available",
  "ok",
  "free",
  "drm",
];

it("localizes every licenseModel enum value in EN and RU without inventing source/DRM meaning", () => {
  for (const model of LICENSE_MODEL_VALUES) {
    const en = licenseModelLabel("en", model);
    const ru = licenseModelLabel("ru", model);
    expect(en.length).toBeGreaterThan(0);
    expect(ru.length).toBeGreaterThan(0);
    expect(en).not.toBe(ru);
    expect(en).not.toBe(model);
    expect(ru).not.toBe(model);
    for (const label of [en, ru]) {
      const normalized = label.toLowerCase();
      for (const banned of SUCCESSISH) {
        expect(normalized).not.toContain(banned);
      }
    }
  }

  expect(licenseModelLabel("en", "single_server")).toBe("One license, one server");
  expect(licenseModelLabel("ru", "single_server")).toBe("Одна лицензия — один сервер");
  expect(licenseModelLabel("en", "multiple_servers")).toBe("Multiple servers");
  expect(licenseModelLabel("ru", "multiple_servers")).toBe("Несколько серверов");
  expect(licenseModelLabel("en", "organization")).toBe("Organization-wide");
  expect(licenseModelLabel("ru", "organization")).toBe("На организацию");
  expect(licenseModelLabel("en", "subscription")).toBe("Subscription");
  expect(licenseModelLabel("ru", "subscription")).toBe("Подписка");
  expect(licenseModelLabel("en", "unlimited")).toBe("Unlimited");
  expect(licenseModelLabel("ru", "unlimited")).toBe("Без ограничений");
});

it("uses a neutral unknown fallback that does not look like success or open-source", () => {
  expect(licenseModelLabel("en", "totally_unknown_model")).toBe("Unknown access model");
  expect(licenseModelLabel("ru", "totally_unknown_model")).toBe("Неизвестная модель доступа");
  expect(licenseModelLabel("en", "")).toBe("Unknown access model");
  for (const locale of ["en", "ru"] as const) {
    const fallback = licenseModelLabel(locale, "open_source");
    const normalized = fallback.toLowerCase();
    expect(normalized).not.toContain("open");
    expect(normalized).not.toContain("source");
    expect(normalized).not.toContain("success");
    expect(fallback).toBe(licenseModelLabel(locale, "totally_unknown_model"));
  }
});

it("keeps orderTermsLicenseLabel aligned with the shared catalog labels", () => {
  for (const model of LICENSE_MODEL_VALUES) {
    expect(orderTermsLicenseLabel("en", model)).toBe(licenseModelLabel("en", model));
    expect(orderTermsLicenseLabel("ru", model)).toBe(licenseModelLabel("ru", model));
  }
  expect(orderTermsLicenseLabel("en", "legacy_unknown")).toBe("Unknown access model");
  expect(orderTermsLicenseLabel("ru", "legacy_unknown")).toBe("Неизвестная модель доступа");
});
