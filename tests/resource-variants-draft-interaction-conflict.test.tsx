import { expect, it, vi } from "vitest";
import { findTestButton } from "./helpers/flatten-react-test-tree";
import {
  actor,
  createResourceVariantsDraftInteractionHelpers,
  latest,
  mockReactHooks,
  response,
} from "./helpers/resource-variants-draft-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  locale: "en" as "en" | "ru",
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("../site/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: harness.locale }),
}));

import { ResourceVariantsForm } from "../site/src/components/resource-variants-form";
import { getResourceManagementCopy } from "../site/src/lib/resource-management-i18n";

const { render, edit, submit } = createResourceVariantsDraftInteractionHelpers(
  harness,
  ResourceVariantsForm,
);

it.each(["en", "ru"] as const)(
  "keeps group edits through a 409 and explicitly accepts the checked revision in %s",
  async (locale) => {
    harness.locale = locale;
    const copy = getResourceManagementCopy(locale);
    edit();
    harness.fetch.mockResolvedValueOnce(response({ code: "RESOURCE_VARIANTS_CONFLICT" }, 409));
    submit();
    await vi.waitFor(() => expect(findTestButton(render(), copy.variantsCheck)).toBeDefined());
    expect(render().find((node) => node.props.id === "variants-field-title")?.props.value).toBe(
      "My draft group",
    );
    harness.fetch
      .mockResolvedValueOnce(response({ profile: actor }))
      .mockResolvedValueOnce(response(latest, 200, "usr_a"));
    (findTestButton(render(), copy.variantsCheck).props.onClick as () => void)();
    await vi.waitFor(() => expect(findTestButton(render(), copy.variantsUseLatest)).toBeDefined());
    expect(render().find((node) => node.props.id === "variants-field-reason")?.props.value).toBe(
      "My draft reason",
    );
    (findTestButton(render(), copy.variantsUseLatest).props.onClick as () => void)();
    harness.fetch.mockResolvedValueOnce(response({ code: "RESOURCE_VARIANTS_CONFLICT" }, 409));
    submit();
    await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledTimes(4));
    const init = harness.fetch.mock.calls[3]?.[1] as RequestInit;
    expect(new Headers(init.headers).get("x-nexus-actor-id")).toBe("usr_a");
    expect(JSON.parse(String(init.body))).toMatchObject({
      expectedGroupId: "vgrp_a",
      expectedRevision: 3,
      title: "My draft group",
      reason: "My draft reason",
      variants: [{ productId: "prd_a", label: "Base" }],
    });
  },
);
