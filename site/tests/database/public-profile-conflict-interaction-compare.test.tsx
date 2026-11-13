import { expect, it, vi } from "vitest";
import { findTestButton } from "../helpers/flatten-react-test-tree";
import {
  createPublicProfileConflictInteractionHelpers,
  latest,
  mockReactHooks,
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

it("keeps the current draft on read failure and closes it if the actor changes", async () => {
  harness.locale = "en";
  const copy = getUserPlatformCopy("en");
  const cleanup = await load();
  harness.request.mockRejectedValueOnce(new Error("response lost"));
  await save(render());
  harness.request.mockRejectedValueOnce(new Error("unauthorized"));
  (findTestButton(render(), copy.profileCompare).props.onClick as () => void)();
  await vi.waitFor(() => expect(harness.slots[3]).toMatchObject({ text: "unauthorized" }));
  expect(render().some((node) => node.type === "form")).toBe(true);
  expect(findTestButton(render(), copy.save).props.disabled).toBe(true);
  harness.request.mockResolvedValueOnce({ profile: { ...latest, id: "usr_2", username: "other" } });
  (findTestButton(render(), copy.profileCompare).props.onClick as () => void)();
  await vi.waitFor(() => expect(render().some((node) => node.type === "form")).toBe(false));
  expect(harness.slots[3]).toMatchObject({ text: copy.profileAccountChanged });
  if (typeof cleanup === "function") cleanup();
});
