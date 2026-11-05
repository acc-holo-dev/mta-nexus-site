import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, type Mock, vi } from "vitest";
import type {
  VerificationOverview,
  VerificationQuery,
  VerificationTargets,
} from "../../apps/web/src/lib/verification-workspace-contract";
import { verificationCopy } from "../../apps/web/src/lib/verification-workspace-copy";
import { findTestButton, flattenReactTestTree } from "./flatten-react-test-tree";

type VerificationApplicationIntentInteractionHarness = {
  slots: unknown[];
  cursor: number;
  effects: (() => unknown)[];
  request: Mock;
  fetch: Mock;
  actor: string;
};

/** Props match VerificationWorkspace so the real component stays assignable. */
type VerificationWorkspaceComponent = (props: {
  actorId: string;
  initial: VerificationOverview | null;
  initialTeams: VerificationTargets | null;
  filters: VerificationQuery;
  teamFilters: VerificationQuery;
  locale: "en" | "ru";
}) => ReactNode;

const filters = {
  page: 1,
  view: "pending" as const,
  type: undefined,
  query: "",
} satisfies VerificationQuery;

const overview = {
  profile: {
    id: "usr_a",
    username: "author",
    name: "Author",
    role: "user",
    identityVerified: false,
    experienceVerified: false,
    hasSpecialties: false,
    identityPending: false,
    experiencePending: false,
  },
  history: { items: [], page: 1, view: "pending" as const, hasMore: false },
} satisfies VerificationOverview;

const teams = {
  items: [{ id: "org_1", name: "Team", slug: "team", verified: false, pending: false }],
  page: 1,
  hasMore: false,
} satisfies VerificationTargets;

export const intentSlot = "nexus:verification-application:v1:usr_a";

/** Shared react mock factory for verification-application intent suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: VerificationApplicationIntentInteractionHarness) {
  return async (original: () => Promise<typeof import("react")>) => ({
    ...(await original()),
    useState: (initial: unknown) => {
      const index = harness.cursor++;
      if (!(index in harness.slots))
        harness.slots[index] =
          typeof initial === "function" ? (initial as () => unknown)() : initial;
      return [
        harness.slots[index],
        (value: unknown) => {
          harness.slots[index] =
            typeof value === "function"
              ? (value as (current: unknown) => unknown)(harness.slots[index])
              : value;
        },
      ];
    },
    useRef: (initial: unknown) => {
      const index = harness.cursor++;
      if (!(index in harness.slots)) harness.slots[index] = { current: initial };
      return harness.slots[index];
    },
    useEffect: (effect: () => unknown) => {
      harness.effects.push(effect);
    },
  });
}

export function createVerificationApplicationIntentInteractionHelpers(
  harness: VerificationApplicationIntentInteractionHarness,
  VerificationWorkspace: VerificationWorkspaceComponent,
) {
  function render() {
    harness.cursor = 0;
    harness.effects = [];
    return flattenReactTestTree(
      VerificationWorkspace({
        actorId: harness.actor,
        initial: overview,
        initialTeams: teams,
        filters,
        teamFilters: filters,
        locale: "en",
      }) as ReactNode,
    );
  }

  function runEffects() {
    render();
    for (const effect of harness.effects) effect();
  }

  async function submit() {
    const form = render().find((node) => node.type === "form" && node.props.onSubmit);
    if (!form) throw new Error("Missing form");
    await (form.props.onSubmit as (event: unknown) => Promise<void>)({ preventDefault() {} });
  }

  async function authenticateAndChoose() {
    harness.fetch.mockImplementation(
      async () =>
        new Response(JSON.stringify({ authenticated: true, user: { id: harness.actor } })),
    );
    runEffects();
    await vi.waitFor(() =>
      expect(findTestButton(render(), verificationCopy("en").choose).props.disabled).toBe(false),
    );
    (findTestButton(render(), verificationCopy("en").choose).props.onClick as () => void)();
  }

  function fillEvidence(
    proofUrl = "https://example.test/evidence",
    notes = "Original private evidence",
  ) {
    let nodes = render();
    const proof = nodes.find((node) => node.type === "input" && node.props.type === "url");
    if (!proof) throw Error("missing proof");
    (proof.props.onChange as (event: unknown) => void)({
      target: { value: proofUrl },
    });
    nodes = render();
    const notesField = nodes.find((node) => node.type === "textarea");
    if (!notesField) throw Error("missing notes");
    (notesField.props.onChange as (event: unknown) => void)({
      target: { value: notes },
    });
  }

  beforeEach(() => {
    harness.slots = [];
    harness.cursor = 0;
    harness.effects = [];
    harness.actor = "usr_a";
    harness.request.mockReset();
    harness.fetch.mockReset();
    const data = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key),
    });
    vi.stubGlobal("fetch", harness.fetch);
  });

  afterEach(() => vi.unstubAllGlobals());

  return { render, runEffects, submit, authenticateAndChoose, fillEvidence };
}
