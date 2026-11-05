import type { ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import { type FlatTestElement, flattenReactTestTree } from "./flatten-react-test-tree";

type VerificationApplicationsHarness = {
  slots: unknown[];
  cursor: number;
  cleanups: (() => void)[];
  fetch: Mock;
  refresh: Mock;
  reload: Mock;
};

type VerificationApplicationAmendComponent = (props: {
  id: string;
  revision: string;
  proofUrl: string | null;
  notes: string | null;
  locale: "en" | "ru";
}) => ReactNode;

type VerificationModerationControlsComponent = (props: {
  requestId: string;
  applicationRevision?: string;
}) => ReactNode;

type ConfirmActionMock = Mock<(...args: unknown[]) => Promise<boolean>>;

export const revision = "a".repeat(64);
export const nextRevision = "b".repeat(64);

export const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Shared react mock factory for verification-applications suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: VerificationApplicationsHarness) {
  return async (original: () => Promise<typeof import("react")>) => ({
    ...(await original()),
    useState: (initial: unknown) => {
      const index = harness.cursor++;
      if (!(index in harness.slots)) harness.slots[index] = initial;
      return [
        harness.slots[index],
        (value: unknown) => {
          harness.slots[index] = value;
        },
      ];
    },
    useRef: (initial: unknown) => {
      const index = harness.cursor++;
      if (!(index in harness.slots)) harness.slots[index] = { current: initial };
      return harness.slots[index];
    },
    useEffect: (effect: () => () => void) => {
      const index = harness.cursor++;
      if (!(index in harness.slots)) {
        harness.slots[index] = true;
        harness.cleanups.push(effect());
      }
    },
  });
}

export function createVerificationApplicationsInteractionHelpers(
  harness: VerificationApplicationsHarness,
  VerificationApplicationAmend: VerificationApplicationAmendComponent,
  VerificationModerationControls: VerificationModerationControlsComponent,
  confirmAction: ConfirmActionMock,
) {
  function render(locale: "en" | "ru" = "en") {
    harness.cursor = 0;
    return flattenReactTestTree(
      VerificationApplicationAmend({
        id: "request",
        revision,
        proofUrl: "https://example.test/proof",
        notes: "Saved evidence",
        locale,
      }),
    );
  }

  function submit(nodes: FlatTestElement[] = render()) {
    const form = nodes.find((node) => node.type === "form");
    if (!form) throw Error("Missing form");
    (form.props.onSubmit as (event: { preventDefault: () => void }) => void)({
      preventDefault() {},
    });
  }

  function amendErrorState(locale: "en" | "ru" = "en") {
    return render(locale).find((node) => (node.type as { name?: string }).name === "ErrorState");
  }

  function moderation() {
    harness.cursor = 0;
    return flattenReactTestTree(
      VerificationModerationControls({ requestId: "request", applicationRevision: revision }),
    );
  }

  function decide(nodes: FlatTestElement[] = moderation()) {
    const button = nodes.find((node) => node.type === "button" && node.props.onClick);
    if (!button) throw Error("Missing decision action");
    (button.props.onClick as () => void)();
  }

  function reviewNotes() {
    const notes = moderation().find((node) => node.type === "textarea");
    if (!notes) throw Error("Missing moderator notes");
    (notes.props.onChange as (event: { target: { value: string } }) => void)({
      target: { value: "Reviewed saved evidence" },
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    harness.slots = [];
    harness.cursor = 0;
    harness.cleanups = [];
    confirmAction.mockReset().mockResolvedValue(true);
    harness.fetch
      .mockReset()
      .mockResolvedValue(response({ id: "request", status: "pending", revision: nextRevision }));
    vi.stubGlobal("fetch", harness.fetch);
    vi.stubGlobal("window", { location: { reload: harness.reload } });
  });

  afterEach(() => {
    for (const cleanup of harness.cleanups) cleanup();
    vi.unstubAllGlobals();
  });

  return {
    render,
    submit,
    amendErrorState,
    moderation,
    decide,
    reviewNotes,
  };
}
