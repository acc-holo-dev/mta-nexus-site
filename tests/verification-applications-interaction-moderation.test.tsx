import { expect, it, vi } from "vitest";
import {
  createVerificationApplicationsInteractionHelpers,
  mockReactHooks,
  response,
  revision,
} from "./helpers/verification-applications-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as (() => void)[],
  fetch: vi.fn(),
  refresh: vi.fn(),
  reload: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../site/src/components/confirm-action", () => ({
  confirmAction,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));
vi.mock("../site/src/components/locale-context", async () => {
  const { getDictionary } = await import("../site/src/lib/i18n");
  return { useNexusLocale: () => ({ locale: "en", dictionary: getDictionary("en") }) };
});

import { VerificationApplicationAmend } from "../site/src/components/verification-application-amend";
import { VerificationModerationControls } from "../site/src/components/verification-moderation-controls";
import { verificationCopy } from "../site/src/lib/verification-workspace-copy";
import { flatTreeHasErrorText } from "./helpers/flatten-react-test-tree";

const { moderation, decide, reviewNotes } = createVerificationApplicationsInteractionHelpers(
  harness,
  VerificationApplicationAmend,
  VerificationModerationControls,
  confirmAction,
);

it("sends the observed evidence revision when deciding and blocks reusing that moderation snapshot", async () => {
  harness.fetch.mockResolvedValue(response({ id: "request", status: "approved" }));
  reviewNotes();
  const nodes = moderation();
  expect(
    nodes.some(
      (node) =>
        node.type === "button" && String(node.props.className ?? "").includes("bg-success-soft"),
    ),
  ).toBe(true);
  expect(
    nodes.some(
      (node) =>
        node.type === "button" && String(node.props.className ?? "").includes("bg-danger-soft"),
    ),
  ).toBe(true);
  decide(nodes);
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledTimes(1));
  decide(nodes);
  expect(harness.fetch).toHaveBeenCalledTimes(1);
  await vi.waitFor(() => expect(harness.refresh).toHaveBeenCalledTimes(1));
  const [url, init] = harness.fetch.mock.calls[0];
  expect(url).toBe("/api/admin/verification/request");
  expect(JSON.parse(init.body)).toEqual({
    decision: "approved",
    reviewNotes: "Reviewed saved evidence",
    expectedApplicationRevision: revision,
  });
  expect(
    moderation().filter((node) => node.type === "button" && node.props.disabled === true),
  ).toHaveLength(2);
});

it("shows a reload action after evidence changes without retrying an old decision", async () => {
  harness.fetch.mockResolvedValue(
    response({ code: "VERIFICATION_APPLICATION_CHANGED", error: "PRIVATE_SQL" }, 409),
  );
  reviewNotes();
  decide();
  await vi.waitFor(() =>
    expect(moderation().some((node) => node.props.role === "alert")).toBe(true),
  );
  expect(flatTreeHasErrorText(moderation(), verificationCopy("en").stateChanged)).toBe(true);
  expect(harness.refresh).not.toHaveBeenCalled();
  expect(
    moderation().some(
      (node) => node.type === "button" && node.props.children === verificationCopy("en").reload,
    ),
  ).toBe(true);
});

it("ignores a moderation response after navigation", async () => {
  let finish!: (response: Response) => void;
  harness.fetch.mockReturnValue(
    new Promise<Response>((resolve) => {
      finish = resolve;
    }),
  );
  reviewNotes();
  decide();
  for (const cleanup of harness.cleanups.splice(0)) cleanup();
  finish(response({ id: "request", status: "approved" }));
  await new Promise((resolve) => setImmediate(resolve));
  expect(harness.refresh).not.toHaveBeenCalled();
});
