import { expect, it, vi } from "vitest";
import {
  createVerificationApplicationIntentInteractionHelpers,
  intentSlot,
  mockReactHooks,
} from "../helpers/verification-application-intent-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effects: [] as (() => unknown)[],
  request: vi.fn(),
  fetch: vi.fn(),
  actor: "usr_a",
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("../../site/src/lib/user-platform-client", async (original) => ({
  ...(await original<typeof import("../../site/src/lib/user-platform-client")>()),
  platformRequest: harness.request,
}));

import { VerificationWorkspace } from "../../site/src/components/verification-workspace";
import { PlatformRequestError } from "../../site/src/lib/user-platform-client";

const { render, runEffects, submit, authenticateAndChoose, fillEvidence } =
  createVerificationApplicationIntentInteractionHelpers(harness, VerificationWorkspace);

it("keeps an unknown application unchanged after reload and pending duplicate", async () => {
  await authenticateAndChoose();
  fillEvidence();
  harness.request.mockRejectedValueOnce(new Error("lost response"));
  await submit();
  expect(sessionStorage.getItem(intentSlot)).toContain("Original private evidence");
  harness.slots = [];
  runEffects();
  await vi.waitFor(() =>
    expect(render().find((node) => node.type === "textarea")?.props.value).toBe(
      "Original private evidence",
    ),
  );
  harness.request.mockRejectedValueOnce(
    new PlatformRequestError("Rate limit", "RATE_LIMIT_EXCEEDED"),
  );
  await submit();
  expect(harness.request).toHaveBeenCalledTimes(2);
  expect(harness.request.mock.calls[1][3]).toEqual(harness.request.mock.calls[0][3]);
  expect(sessionStorage.getItem(intentSlot)).not.toBeNull();
  harness.request.mockRejectedValueOnce(
    new PlatformRequestError("Pending", "VERIFICATION_PENDING"),
  );
  await submit();
  expect(harness.request).toHaveBeenCalledTimes(3);
  expect(sessionStorage.getItem(intentSlot)).not.toBeNull();
});
