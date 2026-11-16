import { expect, it, vi } from "vitest";
import { findTestButton } from "../helpers/flatten-react-test-tree";
import {
  createPublicProfileConflictInteractionHelpers,
  latest,
  mockReactHooks,
  original,
} from "../helpers/public-profile-conflict-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effect: null as null | (() => undefined | (() => void)),
  request: vi.fn(),
  refresh: vi.fn(),
  locale: "en" as "en" | "ru",
}));
vi.mock("react", (originalModule) => mockReactHooks(harness)(originalModule));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("../../src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: harness.locale }),
}));
vi.mock("../../src/lib/user-platform-client", async (originalModule) => ({
  ...(await originalModule<typeof import("../../src/lib/user-platform-client")>()),
  platformRequest: harness.request,
}));

import { PublicProfileForm } from "../../src/components/public-profile-form";
import { getUserPlatformCopy } from "../../src/lib/user-platform-copy";

const { render, load, save } = createPublicProfileConflictInteractionHelpers(
  harness,
  PublicProfileForm,
);

it.each(["en", "ru"] as const)(
  "keeps the draft until explicitly accepting a checked saved profile in %s",
  async (locale) => {
    harness.locale = locale;
    const copy = getUserPlatformCopy(locale);
    const cleanup = await load();
    harness.request.mockRejectedValueOnce(new Error("response lost"));
    const form = render().find((node) => node.type === "form");
    await save(render());
    expect(findTestButton(render(), copy.save).props.disabled).toBe(true);
    harness.request.mockResolvedValueOnce({ profile: latest });
    (findTestButton(render(), copy.profileCompare).props.onClick as () => void)();
    await vi.waitFor(() => expect(findTestButton(render(), copy.profileUseLatest)).toBeDefined());
    expect(render().find((node) => node.type === "form")?.key).toBe(form?.key);
    (findTestButton(render(), copy.profileUseLatest).props.onClick as () => void)();
    expect(render().find((node) => node.type === "form")?.key).toBe(form?.key);
    harness.request.mockRejectedValueOnce(new Error("conflict"));
    await save(render());
    expect(harness.request.mock.calls[3]?.[3]).toMatchObject({
      displayName: "My draft",
      bio: "My unsaved bio",
      expectedActorId: original.id,
      expectedUpdatedAt: latest.updatedAt,
    });
    if (typeof cleanup === "function") cleanup();
  },
);
