import { expect, it, vi } from "vitest";
import { findTestButton } from "../helpers/flatten-react-test-tree";
import {
  actor,
  createResourceCompatibilityDraftInteractionHelpers,
  latest,
  mockReactHooks,
  response,
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
vi.mock("../../src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: harness.locale }),
}));

import { ResourceCompatibilityForm } from "../../src/components/resource-compatibility-form";
import { getResourceManagementCopy } from "../../src/lib/resource-management-i18n";

const { render, edit, submit } = createResourceCompatibilityDraftInteractionHelpers(
  harness,
  ResourceCompatibilityForm,
);

it.each(["en", "ru"] as const)(
  "keeps the draft after 409 and requires comparison in %s",
  async (locale) => {
    harness.locale = locale;
    const copy = getResourceManagementCopy(locale);
    edit();
    harness.fetch.mockResolvedValueOnce(response({ code: "PRODUCT_METADATA_CONFLICT" }, 409));
    submit();
    await vi.waitFor(() => expect(findTestButton(render(), copy.compatibilityCheck)).toBeDefined());
    expect(harness.refresh).not.toHaveBeenCalled();
    expect(render().find((node) => node.type === "textarea")?.props.value).toBe("my-resource");
    harness.fetch
      .mockResolvedValueOnce(response({ profile: actor }))
      .mockResolvedValueOnce(response({ actorId: "usr_a", product: latest }));
    (findTestButton(render(), copy.compatibilityCheck).props.onClick as () => void)();
    await vi.waitFor(() =>
      expect(findTestButton(render(), copy.compatibilityUseLatest)).toBeDefined(),
    );
    expect(render().find((node) => node.type === "textarea")?.props.value).toBe("my-resource");
    (findTestButton(render(), copy.compatibilityUseLatest).props.onClick as () => void)();
    harness.fetch.mockResolvedValueOnce(response({ code: "PRODUCT_METADATA_CONFLICT" }, 409));
    submit();
    await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledTimes(4));
    const init = harness.fetch.mock.calls[3]?.[1] as RequestInit;
    expect(new Headers(init.headers).get("x-nexus-actor-id")).toBe("usr_a");
    expect(JSON.parse(String(init.body))).toMatchObject({
      expectedUpdatedAt: latest.updatedAt,
      compatibility: { dependencies: ["my-resource"] },
    });
  },
);
