import { expect, it, vi } from "vitest";
import { findTestButton } from "./helpers/flatten-react-test-tree";
import {
  createVerificationApplicationIntentInteractionHelpers,
  intentSlot,
  mockReactHooks,
} from "./helpers/verification-application-intent-interaction-harness";

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
vi.mock("../apps/web/src/lib/user-platform-client", async (original) => ({
  ...(await original<typeof import("../apps/web/src/lib/user-platform-client")>()),
  platformRequest: harness.request,
}));

import { VerificationWorkspace } from "../apps/web/src/components/verification-workspace";
import { PlatformRequestError } from "../apps/web/src/lib/user-platform-client";
import { verificationCopy } from "../apps/web/src/lib/verification-workspace-copy";

const { render, submit, authenticateAndChoose, fillEvidence } =
  createVerificationApplicationIntentInteractionHelpers(harness, VerificationWorkspace);

it("unlocks a first submission when the target already has a pending application", async () => {
  await authenticateAndChoose();
  fillEvidence();
  harness.request.mockRejectedValueOnce(
    new PlatformRequestError("Pending", "VERIFICATION_PENDING"),
  );
  await submit();
  expect(sessionStorage.getItem(intentSlot)).toBeNull();
  expect(findTestButton(render(), verificationCopy("en").choose).props.disabled).toBe(false);
});
