import { expect, it, vi } from "vitest";
import {
  createAuthorPublicationDeskInteractionHelpers,
  mockReactHooks,
  next,
  response,
  revision,
} from "../helpers/author-publication-desk-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as (() => void)[],
  fetch: vi.fn(),
  refresh: vi.fn(),
  reload: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../../src/components/confirm-action", () => ({
  confirmAction,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));

import { AuthorPublicationRestore } from "../../src/components/author-publication-restore";
import { authorPublicationDeskCopy } from "../../src/lib/author-publication-desk-copy";

const { render, button, click, errorState, hasErrorAlert } =
  createAuthorPublicationDeskInteractionHelpers(harness, AuthorPublicationRestore, confirmAction);

it("coalesces rapid commands while the first exact-version write is pending", async () => {
  let finish!: (reply: Response) => void;
  harness.fetch.mockReset().mockReturnValue(
    new Promise<Response>((resolve) => {
      finish = resolve;
    }),
  );
  const nodes = render();
  click(nodes, authorPublicationDeskCopy("en").restore);
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledTimes(1));
  click(nodes, authorPublicationDeskCopy("en").restore);
  expect(harness.fetch).toHaveBeenCalledTimes(1);
  expect(render()[0].props["aria-busy"]).toBe(true);
  finish(response({ id: "article", status: "draft", revision: next }));
  await vi.waitFor(() => expect(harness.refresh).toHaveBeenCalledTimes(1));
});

it.each([
  { id: "foreign", status: "draft", revision: next },
  { id: "article", status: "published", revision: next },
  { id: "article", status: "draft", revision },
  { id: "article", status: "draft", revision: next, body: "extra-private-data" },
  null,
])("requires a saved-state reload after an uncertain acknowledgement %j", async (reply) => {
  harness.fetch.mockResolvedValue(response(reply));
  const copy = authorPublicationDeskCopy("en");
  click(render(), copy.restore);
  await vi.waitFor(() => expect(hasErrorAlert(render())).toBe(true));
  expect(typeof errorState(render())?.props.title).toBe("string");
  expect(harness.refresh).not.toHaveBeenCalled();
  expect(button(render(), copy.restore).props.disabled).toBe(true);
  click(render(), copy.restore);
  expect(harness.fetch).toHaveBeenCalledTimes(1);
  click(render(), copy.reload);
  expect(harness.refresh).toHaveBeenCalledTimes(1);
});

it.each(["CONFLICT", "FORBIDDEN", "PUBLICATION_RESTORE_DENIED"])(
  "shows a safe localized recovery error for %s without retrying the stale version",
  async (code) => {
    harness.fetch.mockResolvedValue(
      response({ code, error: "PRIVATE_DATABASE_DETAILS" }, code === "CONFLICT" ? 409 : 403),
    );
    const copy = authorPublicationDeskCopy("ru");
    click(render("ru"), copy.restore);
    await vi.waitFor(() => expect(hasErrorAlert(render("ru"))).toBe(true));
    const alert = errorState(render("ru"));
    expect(alert?.props.title).toBeTruthy();
    expect(String(alert?.props.title)).not.toContain("PRIVATE_DATABASE_DETAILS");
    expect(button(render("ru"), copy.restore).props.disabled).toBe(true);
    expect(harness.refresh).not.toHaveBeenCalled();
  },
);

it("aborts on navigation and ignores late confirmation", async () => {
  let finish!: (reply: Response) => void;
  harness.fetch.mockReset().mockReturnValue(
    new Promise<Response>((resolve) => {
      finish = resolve;
    }),
  );
  click(render(), authorPublicationDeskCopy("en").restore);
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledTimes(1));
  const signal = harness.fetch.mock.calls[0][1].signal;
  for (const cleanup of harness.cleanups.splice(0)) cleanup();
  expect(signal.aborted).toBe(true);
  finish(response({ id: "article", status: "draft", revision: next }));
  await new Promise((resolve) => setImmediate(resolve));
  expect(harness.refresh).not.toHaveBeenCalled();
});
