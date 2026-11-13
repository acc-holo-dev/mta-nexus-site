import { expect, it, vi } from "vitest";
import {
  createVerificationApplicationsInteractionHelpers,
  mockReactHooks,
  nextRevision,
  response,
  revision,
} from "../helpers/verification-applications-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as (() => void)[],
  fetch: vi.fn(),
  refresh: vi.fn(),
  reload: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../../site/src/components/confirm-action", () => ({
  confirmAction,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));
vi.mock("../../site/src/components/locale-context", async () => {
  const { getDictionary } = await import("../../site/src/lib/i18n");
  return { useNexusLocale: () => ({ locale: "en", dictionary: getDictionary("en") }) };
});

import { VerificationApplicationAmend } from "../../site/src/components/verification-application-amend";
import { VerificationModerationControls } from "../../site/src/components/verification-moderation-controls";
import { verificationApplicationsCopy } from "../../site/src/lib/verification-applications-copy";
import { verificationCopy } from "../../site/src/lib/verification-workspace-copy";
import { flatTreeHasErrorText } from "../helpers/flatten-react-test-tree";

const { render, submit, amendErrorState } = createVerificationApplicationsInteractionHelpers(
  harness,
  VerificationApplicationAmend,
  VerificationModerationControls,
  confirmAction,
);

it.each([
  { id: "foreign", status: "pending", revision: nextRevision },
  { id: "request", status: "approved", revision: nextRevision },
  { id: "request", status: "pending", revision },
  { id: "request", status: "pending", revision: nextRevision, extra: true },
  null,
])("requires reload after an uncertain acknowledgement %j", async (reply) => {
  harness.fetch.mockResolvedValue(response(reply));
  submit();
  await vi.waitFor(() => expect(amendErrorState()).toBeDefined());
  const title = String(amendErrorState()?.props.title ?? "");
  expect(title.length).toBeGreaterThan(0);
  expect(flatTreeHasErrorText(render(), title)).toBe(true);
  if (reply !== null) {
    expect(title).toBe(verificationApplicationsCopy("en").uncertain);
  }
  expect(harness.refresh).not.toHaveBeenCalled();
  expect(render().find((node) => node.type === "fieldset")?.props.disabled).toBe(true);
  submit();
  expect(harness.fetch).toHaveBeenCalledTimes(1);
  const reload = render().find(
    (node) => node.type === "button" && node.props.children === verificationCopy("en").reload,
  );
  if (!reload) throw Error("Missing reload action");
  (reload.props.onClick as () => void)();
  expect(harness.refresh).toHaveBeenCalledTimes(1);
});

it.each(["VERIFICATION_APPLICATION_CHANGED", "VERIFICATION_AUTHORITY_CHANGED", "NOT_FOUND"])(
  "localizes %s and blocks retries with the stale version",
  async (code) => {
    harness.fetch.mockResolvedValue(response({ code, error: "PRIVATE_SQL" }, 409));
    submit(render("ru"));
    await vi.waitFor(() => expect(amendErrorState("ru")).toBeDefined());
    const title = String(amendErrorState("ru")?.props.title ?? "");
    expect(title).not.toContain("PRIVATE_SQL");
    expect(flatTreeHasErrorText(render("ru"), title)).toBe(true);
    expect(harness.refresh).not.toHaveBeenCalled();
  },
);

it("aborts on navigation and ignores late acknowledgements", async () => {
  let finish!: (response: Response) => void;
  harness.fetch.mockReturnValue(
    new Promise<Response>((resolve) => {
      finish = resolve;
    }),
  );
  submit();
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledTimes(1));
  const signal = harness.fetch.mock.calls[0][1].signal;
  for (const cleanup of harness.cleanups.splice(0)) cleanup();
  expect(signal.aborted).toBe(true);
  finish(response({ id: "request", status: "pending", revision: nextRevision }));
  await new Promise((resolve) => setImmediate(resolve));
  expect(harness.refresh).not.toHaveBeenCalled();
});
