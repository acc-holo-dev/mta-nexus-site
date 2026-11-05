import { expect, it, vi } from "vitest";
import {
  createAuthorPublicationDeskInteractionHelpers,
  mockReactHooks,
  revision,
} from "./helpers/author-publication-desk-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as (() => void)[],
  fetch: vi.fn(),
  refresh: vi.fn(),
  reload: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../apps/web/src/components/confirm-action", () => ({
  confirmAction,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));

import { AuthorPublicationRestore } from "../apps/web/src/components/author-publication-restore";
import { authorPublicationDeskCopy } from "../apps/web/src/lib/author-publication-desk-copy";

const { render, button, click } = createAuthorPublicationDeskInteractionHelpers(
  harness,
  AuthorPublicationRestore,
  confirmAction,
);

it.each(["en", "ru"] as const)(
  "restores the exact observed version and refreshes history only after a strict draft acknowledgement in %s",
  async (locale) => {
    const copy = authorPublicationDeskCopy(locale);
    click(render(locale), copy.restore);
    await vi.waitFor(() => expect(harness.refresh).toHaveBeenCalledTimes(1));
    expect(confirmAction).toHaveBeenCalledWith(
      expect.objectContaining({ consequences: copy.restoreConfirm }),
    );
    const [url, init] = harness.fetch.mock.calls[0];
    expect(url).toBe("/api/workspace/content/article/restore");
    expect(init).toMatchObject({ method: "POST", cache: "no-store", credentials: "same-origin" });
    expect(JSON.parse(init.body)).toEqual({ expectedRevision: revision });
    expect(
      render(locale).some(
        (node) => node.props.role === "status" && node.props.children === copy.restoredNotice,
      ),
    ).toBe(true);
    expect(button(render(locale), copy.restore).props.disabled).toBe(true);
    expect(render(locale).some((node) => node.props.href === "/workspace/content/article")).toBe(
      true,
    );
  },
);

it("allows cancellation without sending a command", () => {
  confirmAction.mockResolvedValueOnce(false);
  click(render(), authorPublicationDeskCopy("en").restore);
  expect(harness.fetch).not.toHaveBeenCalled();
  expect(button(render(), authorPublicationDeskCopy("en").restore).props.disabled).toBe(false);
});
