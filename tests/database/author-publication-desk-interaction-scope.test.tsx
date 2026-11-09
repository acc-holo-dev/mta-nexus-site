import { expect, it, vi } from "vitest";
import {
  createAuthorPublicationDeskInteractionHelpers,
  mockReactHooks,
  next,
  response,
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
vi.mock("../../apps/web/src/components/confirm-action", () => ({
  confirmAction,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));

import { AuthorPublicationRestore } from "../../apps/web/src/components/author-publication-restore";
import { authorPublicationDeskCopy } from "../../apps/web/src/lib/author-publication-desk-copy";

const { render, button, click, errorState, hasErrorAlert } =
  createAuthorPublicationDeskInteractionHelpers(harness, AuthorPublicationRestore, confirmAction);

it.each(["ru", "en"] as const)(
  "restores a team archive with a scope-bound acknowledgement in %s",
  async (locale) => {
    const { organizationPublicationHistoryCopy } = await import(
      "../../apps/web/src/lib/organization-publication-history-copy"
    );
    const copy = organizationPublicationHistoryCopy(locale),
      labels = authorPublicationDeskCopy(locale);
    harness.fetch.mockResolvedValue(
      response({ id: "article", organizationId: "org", status: "draft", revision: next }),
    );
    click(render(locale, "org"), labels.restore);
    await vi.waitFor(() => expect(harness.refresh).toHaveBeenCalledTimes(1));
    expect(confirmAction).toHaveBeenCalledWith(
      expect.objectContaining({ consequences: copy.restoreConfirm }),
    );
    expect(harness.fetch.mock.calls[0][0]).toBe(
      "/api/workspace/organizations/org/content/article/restore",
    );
    expect(render(locale, "org").some((node) => node.props.children === copy.restoredNotice)).toBe(
      true,
    );
    expect(
      render(locale, "org").some(
        (node) => node.props.href === "/workspace/organizations/org/content/article",
      ),
    ).toBe(true);
  },
);

it.each(["foreign", undefined])(
  "blocks retry after mismatched organization acknowledgement (%s)",
  async (organizationId) => {
    harness.fetch.mockResolvedValue(
      response({ id: "article", organizationId, status: "draft", revision: next }),
    );
    const copy = authorPublicationDeskCopy("en");
    click(render("en", "org"), copy.restore);
    await vi.waitFor(() => expect(hasErrorAlert(render("en", "org"), copy.uncertain)).toBe(true));
    expect(errorState(render("en", "org"))?.props.title).toBe(copy.uncertain);
    expect(harness.refresh).not.toHaveBeenCalled();
    expect(button(render("en", "org"), copy.restore).props.disabled).toBe(true);
    click(render("en", "org"), copy.restore);
    expect(harness.fetch).toHaveBeenCalledTimes(1);
  },
);

it.each(["ru", "en"] as const)(
  "restores an exact server archive to a confirmed draft in %s",
  async (locale) => {
    const { serverPublicationHistoryCopy } = await import(
      "../../apps/web/src/lib/server-publication-history-copy"
    );
    const copy = serverPublicationHistoryCopy(locale),
      labels = authorPublicationDeskCopy(locale);
    harness.fetch.mockResolvedValue(
      response({ id: "article", serverId: "srv", status: "draft", revision: next }),
    );
    click(render(locale, undefined, "srv"), labels.restore);
    await vi.waitFor(() => expect(harness.refresh).toHaveBeenCalledTimes(1));
    expect(harness.fetch.mock.calls[0][0]).toBe(
      "/api/workspace/servers/srv/content/article/restore",
    );
    expect(confirmAction).toHaveBeenCalledWith(
      expect.objectContaining({ consequences: copy.restoreConfirm }),
    );
    expect(
      render(locale, undefined, "srv").some((node) => node.props.children === copy.restoredNotice),
    ).toBe(true);
    expect(
      render(locale, undefined, "srv").some(
        (node) => node.props.href === "/workspace/servers/srv/content/article",
      ),
    ).toBe(true);
  },
);

it("requires reload on a scope-mismatched server restore acknowledgement", async () => {
  harness.fetch.mockResolvedValue(
    response({ id: "article", serverId: "foreign", status: "draft", revision: next }),
  );
  const copy = authorPublicationDeskCopy("en");
  click(render("en", undefined, "srv"), copy.restore);
  await vi.waitFor(() =>
    expect(hasErrorAlert(render("en", undefined, "srv"), copy.uncertain)).toBe(true),
  );
  expect(errorState(render("en", undefined, "srv"))?.props.title).toBe(copy.uncertain);
  expect(harness.refresh).not.toHaveBeenCalled();
  expect(button(render("en", undefined, "srv"), copy.restore).props.disabled).toBe(true);
});
