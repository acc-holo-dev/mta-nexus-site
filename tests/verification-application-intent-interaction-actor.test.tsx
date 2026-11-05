import { expect, it, vi } from "vitest";
import {
  createVerificationApplicationIntentInteractionHelpers,
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

const { render, runEffects } = createVerificationApplicationIntentInteractionHelpers(
  harness,
  VerificationWorkspace,
);

it("does not show actor A draft when switched to B", async () => {
  sessionStorage.setItem(
    "nexus:verification-application:v1:usr_a",
    JSON.stringify({
      actorId: "usr_a",
      targetName: "Team",
      request: {
        targetType: "organization",
        targetId: "org_1",
        proofUrl: "https://example.test/evidence",
        notes: "Private evidence A",
      },
    }),
  );
  harness.fetch.mockImplementation(
    async () => new Response(JSON.stringify({ authenticated: true, user: { id: harness.actor } })),
  );
  runEffects();
  await vi.waitFor(() =>
    expect(render().find((node) => node.type === "textarea")?.props.value).toBe(
      "Private evidence A",
    ),
  );
  harness.actor = "usr_b";
  expect(render().find((node) => node.type === "textarea")).toBeUndefined();
});
