import { expect, it, vi } from "vitest";
import {
  createPublicProfileConflictInteractionHelpers,
  latest,
  mockReactHooks,
  original,
} from "./helpers/public-profile-conflict-interaction-harness";

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
vi.mock("../site/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: harness.locale }),
}));
vi.mock("../site/src/lib/user-platform-client", async (originalModule) => ({
  ...(await originalModule<typeof import("../site/src/lib/user-platform-client")>()),
  platformRequest: harness.request,
}));

import { PublicProfileForm } from "../site/src/components/public-profile-form";
import { PlatformRequestError } from "../site/src/lib/user-platform-client";
import { getUserPlatformCopy } from "../site/src/lib/user-platform-copy";

const { render, load, save } = createPublicProfileConflictInteractionHelpers(
  harness,
  PublicProfileForm,
);

it.each(["en", "ru"] as const)(
  "closes the old draft when the server detects a changed account in %s",
  async (locale) => {
    harness.locale = locale;
    const cleanup = await load();
    const message = locale === "en" ? "Account changed" : "Аккаунт изменился";
    harness.request.mockRejectedValueOnce(new PlatformRequestError(message, "ACCOUNT_CHANGED"));
    await save(render());
    expect(harness.request.mock.calls[1]?.[3]).toMatchObject({
      expectedActorId: original.id,
      expectedUpdatedAt: original.updatedAt,
    });
    expect(render().some((node) => node.type === "form")).toBe(false);
    expect(harness.slots[3]).toMatchObject({ text: message, error: true });
    if (typeof cleanup === "function") cleanup();
  },
);

it("closes the previous draft if a save response identifies a different actor", async () => {
  harness.locale = "en";
  const cleanup = await load();
  harness.request.mockResolvedValueOnce({
    success: true,
    profile: { ...latest, id: "usr_2", username: "other" },
  });
  await save(render());
  expect(render().some((node) => node.type === "form")).toBe(false);
  expect(harness.slots[3]).toMatchObject({ text: getUserPlatformCopy("en").profileAccountChanged });
  if (typeof cleanup === "function") cleanup();
});
