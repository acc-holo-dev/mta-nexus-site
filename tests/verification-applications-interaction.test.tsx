import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as (() => void)[],
  fetch: vi.fn(),
  refresh: vi.fn(),
  confirm: vi.fn(),
  reload: vi.fn(),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
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
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));
vi.mock("../apps/web/src/components/locale-context", async () => {
  const { getDictionary } = await import("../apps/web/src/lib/i18n");
  return { useNexusLocale: () => ({ locale: "en", dictionary: getDictionary("en") }) };
});

import { VerificationApplicationAmend } from "../apps/web/src/components/verification-application-amend";
import { VerificationModerationControls } from "../apps/web/src/components/verification-moderation-controls";
import { verificationApplicationsCopy } from "../apps/web/src/lib/verification-applications-copy";
import { verificationCopy } from "../apps/web/src/lib/verification-workspace-copy";

const revision = "a".repeat(64),
  next = "b".repeat(64);
type Element = ReactElement<Record<string, unknown>>;
function descendants(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(descendants);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Element;
  const type = element.type as { displayName?: string } | string;
  if (typeof type === "object" && type?.displayName === "Button") {
    return [
      { ...element, type: "button" } as Element,
      ...descendants(element.props.children as ReactNode),
    ];
  }
  return [element, ...descendants(element.props.children as ReactNode)];
}
function render(locale: "en" | "ru" = "en") {
  harness.cursor = 0;
  return descendants(
    VerificationApplicationAmend({
      id: "request",
      revision,
      proofUrl: "https://example.test/proof",
      notes: "Saved evidence",
      locale,
    }),
  );
}
function submit(nodes = render()) {
  const form = nodes.find((node) => node.type === "form");
  if (!form) throw Error("Missing form");
  (form.props.onSubmit as (event: { preventDefault: () => void }) => void)({ preventDefault() {} });
}
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
beforeEach(() => {
  vi.clearAllMocks();
  harness.slots = [];
  harness.cursor = 0;
  harness.cleanups = [];
  harness.confirm.mockReturnValue(true);
  harness.fetch
    .mockReset()
    .mockResolvedValue(response({ id: "request", status: "pending", revision: next }));
  vi.stubGlobal("fetch", harness.fetch);
  vi.stubGlobal("window", { confirm: harness.confirm, location: { reload: harness.reload } });
});
afterEach(() => {
  for (const cleanup of harness.cleanups) cleanup();
  vi.unstubAllGlobals();
});
it.each(["en", "ru"] as const)(
  "submits edited evidence with the observed version and refreshes only after strict acknowledgement in %s",
  async (locale) => {
    const input = render(locale).find((node) => node.type === "textarea");
    if (!input) throw Error("Missing evidence field");
    (input.props.onChange as (event: { target: { value: string } }) => void)({
      target: { value: "Updated evidence" },
    });
    submit(render(locale));
    await vi.waitFor(() => expect(harness.refresh).toHaveBeenCalledTimes(1));
    expect(harness.confirm).toHaveBeenCalledWith(verificationApplicationsCopy(locale).confirm);
    const [url, init] = harness.fetch.mock.calls[0];
    expect(url).toBe("/api/workspace/verification/request");
    expect(init).toMatchObject({ method: "PATCH", cache: "no-store", credentials: "same-origin" });
    expect(JSON.parse(init.body)).toEqual({
      expectedRevision: revision,
      proofUrl: "https://example.test/proof",
      notes: "Updated evidence",
    });
    expect(
      render(locale).some(
        (node) =>
          node.props.role === "status" &&
          node.props.children === verificationApplicationsCopy(locale).saved,
      ),
    ).toBe(true);
    expect(render(locale).find((node) => node.type === "fieldset")?.props.disabled).toBe(true);
  },
);
it("cancels without sending a command", () => {
  harness.confirm.mockReturnValue(false);
  submit();
  expect(harness.fetch).not.toHaveBeenCalled();
  expect(render().find((node) => node.type === "fieldset")?.props.disabled).toBe(false);
});
it("coalesces rapid writes while the first command is pending", async () => {
  let finish!: (response: Response) => void;
  harness.fetch.mockReturnValue(
    new Promise<Response>((resolve) => {
      finish = resolve;
    }),
  );
  const nodes = render();
  submit(nodes);
  submit(nodes);
  expect(harness.fetch).toHaveBeenCalledTimes(1);
  expect(render()[0].props["aria-busy"]).toBe(true);
  finish(response({ id: "request", status: "pending", revision: next }));
  await vi.waitFor(() => expect(harness.refresh).toHaveBeenCalledTimes(1));
});
it.each([
  { id: "foreign", status: "pending", revision: next },
  { id: "request", status: "approved", revision: next },
  { id: "request", status: "pending", revision },
  { id: "request", status: "pending", revision: next, extra: true },
  null,
])("requires reload after an uncertain acknowledgement %j", async (reply) => {
  harness.fetch.mockResolvedValue(response(reply));
  submit();
  await vi.waitFor(() => expect(render().some((node) => node.props.role === "alert")).toBe(true));
  expect(harness.refresh).not.toHaveBeenCalled();
  expect(render().find((node) => node.type === "fieldset")?.props.disabled).toBe(true);
  submit();
  expect(harness.fetch).toHaveBeenCalledTimes(1);
  const reload = render().find(
    (node) => node.type === "button" && node.props.children === verificationCopy("en").reload,
  );
  if (!reload) throw Error("Missing reload action");
  (reload.props.onClick as () => void)();
  expect(harness.reload).toHaveBeenCalledTimes(1);
});
it.each(["VERIFICATION_APPLICATION_CHANGED", "VERIFICATION_AUTHORITY_CHANGED", "NOT_FOUND"])(
  "localizes %s and blocks retries with the stale version",
  async (code) => {
    harness.fetch.mockResolvedValue(response({ code, error: "PRIVATE_SQL" }, 409));
    submit(render("ru"));
    await vi.waitFor(() =>
      expect(render("ru").some((node) => node.props.role === "alert")).toBe(true),
    );
    expect(render("ru").find((node) => node.props.role === "alert")?.props.children).not.toContain(
      "PRIVATE_SQL",
    );
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
  const signal = harness.fetch.mock.calls[0][1].signal;
  for (const cleanup of harness.cleanups.splice(0)) cleanup();
  expect(signal.aborted).toBe(true);
  finish(response({ id: "request", status: "pending", revision: next }));
  await new Promise((resolve) => setImmediate(resolve));
  expect(harness.refresh).not.toHaveBeenCalled();
});
function moderation() {
  harness.cursor = 0;
  return descendants(
    VerificationModerationControls({ requestId: "request", applicationRevision: revision }),
  );
}
function decide(nodes = moderation()) {
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
  expect(moderation().find((node) => node.props.role === "alert")?.props.children).toBe(
    verificationCopy("en").stateChanged,
  );
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
