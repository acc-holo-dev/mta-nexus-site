import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  request: vi.fn(),
  onPending: vi.fn(),
  onSaved: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../apps/web/src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.slots)) harness.slots[index] = initial;
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
  useEffect: () => {
    // Abort cleanup is out of scope for confirm coverage.
  },
}));
vi.mock("../apps/web/src/lib/user-platform-client", async (original) => {
  const actual = await original<typeof import("../apps/web/src/lib/user-platform-client")>();
  return {
    ...actual,
    platformRequest: harness.request,
  };
});

import { DiscussionCommentActions } from "../apps/web/src/components/discussion-comment-actions";
import type { DiscussionPage } from "../apps/web/src/lib/content-discussion-contract";
import { getDiscussionCopy } from "../apps/web/src/lib/content-discussion-copy";

type Element = ReactElement<Record<string, unknown>>;

const revision = "a".repeat(64);
const comment: DiscussionPage["items"][number] = {
  id: "cmt_aaaaaaaaaaaaaaaaaaaaaaaa",
  revision,
  text: "Please clarify the install steps.",
  parentId: null,
  createdAt: "2026-10-11T00:00:00.000Z",
  author: {
    id: "usr_author",
    username: "author",
    displayName: "Author",
    avatarUrl: null,
  },
  parent: null,
};
const contentId = "cnt_aaaaaaaaaaaaaaaaaaaaaaaa";
const slug = "guide";

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

function seedIdle() {
  // mode, text, revision, reason, error, pending, draftNotice, busy, alive, controller, blocked
  harness.slots = [
    null,
    comment.text,
    comment.revision,
    "",
    "",
    false,
    "",
    { current: false },
    { current: true },
    { current: null },
    false,
  ];
}

function seedModeratorRemove() {
  harness.slots = [
    "remove",
    comment.text,
    comment.revision,
    "Spam and off-topic",
    "",
    false,
    "",
    { current: false },
    { current: true },
    { current: null },
    false,
  ];
}

function render(own: boolean, locale: "en" | "ru" = "en") {
  harness.cursor = 0;
  return descendants(
    DiscussionCommentActions({
      comment,
      own,
      slug,
      contentId,
      locale,
      disabled: false,
      onPending: harness.onPending,
      onSaved: harness.onSaved,
    }),
  );
}

function control(nodes: Element[], label: string) {
  const found = nodes.find((node) => node.type === "button" && node.props.children === label);
  if (!found) throw new Error(`Missing ${label}`);
  return found;
}

function submit(nodes: Element[]) {
  const form = nodes.find((node) => node.type === "form");
  if (!form) throw new Error("Missing moderation remove form");
  return (form.props.onSubmit as (event: { preventDefault: () => void }) => Promise<void>)({
    preventDefault() {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  harness.cursor = 0;
  seedIdle();
  confirmAction.mockResolvedValue(true);
  harness.request.mockReset();
  harness.onPending.mockReset();
  harness.onSaved.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it("confirms own comment removal before DELETE", async () => {
  const copy = getDiscussionCopy("en");
  harness.request.mockResolvedValueOnce({
    contentId,
    commentId: comment.id,
    removed: true,
  });

  await (control(render(true), copy.remove).props.onClick as () => Promise<void>)();
  await vi.waitFor(() => expect(harness.request).toHaveBeenCalled());

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.removeConfirmTitle,
    object: comment.text,
    consequences: copy.removeNote,
    confirmLabel: copy.confirmRemove,
    cancelLabel: copy.cancelEdit,
    closeLabel: copy.cancelEdit,
    danger: true,
  });
  expect(harness.request).toHaveBeenCalledWith(
    `/api/content/${encodeURIComponent(slug)}/comments/${encodeURIComponent(comment.id)}`,
    "en",
    "DELETE",
    { expectedRevision: revision },
    expect.any(AbortSignal),
    expect.any(Function),
  );
  expect(harness.onSaved).toHaveBeenCalled();
});

it("keeps the own comment when confirmation is cancelled", async () => {
  const copy = getDiscussionCopy("en");
  confirmAction.mockResolvedValueOnce(false);
  await (control(render(true), copy.remove).props.onClick as () => Promise<void>)();
  expect(harness.request).not.toHaveBeenCalled();
  expect(harness.onSaved).not.toHaveBeenCalled();
});

it.each(["en", "ru"] as const)(
  "preserves an edit draft after an unconfirmed save and gives a manual copy fallback in %s",
  async (locale) => {
    const copy = getDiscussionCopy(locale);
    const writeText = vi.fn().mockRejectedValue(new Error("clipboard denied"));
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    (control(render(true, locale), copy.edit).props.onClick as () => void)();
    const textarea = render(true, locale).find((node) => node.type === "textarea");
    if (!textarea) throw new Error("Missing comment editor");
    (textarea.props.onChange as (event: unknown) => void)({ target: { value: "Unsaved draft" } });
    harness.request.mockRejectedValueOnce(new Error("response lost"));
    await submit(render(true, locale));
    await vi.waitFor(() => expect(control(render(true, locale), copy.copyDraft)).toBeDefined());
    expect(render(true, locale).find((node) => node.type === "textarea")?.props.value).toBe(
      "Unsaved draft",
    );
    (control(render(true, locale), copy.copyDraft).props.onClick as () => void)();
    await vi.waitFor(() =>
      expect(
        render(true, locale).some((node) => node.props.children === copy.draftCopyFailed),
      ).toBe(true),
    );
    expect(writeText).toHaveBeenCalledWith("Unsaved draft");
    expect(copy.formErrorHint).toBe(
      locale === "ru"
        ? "Результат не подтверждён. Проверьте сохранённый комментарий перед повторной попыткой."
        : "The result could not be confirmed. Check the saved comment before trying again.",
    );
  },
);

it("confirms moderator comment removal before DELETE", async () => {
  const copy = getDiscussionCopy("en");
  seedModeratorRemove();
  harness.request.mockResolvedValueOnce({
    contentId,
    commentId: comment.id,
    removed: true,
  });

  await submit(render(false));
  await vi.waitFor(() => expect(harness.request).toHaveBeenCalled());

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.moderateRemoveConfirmTitle,
    object: comment.text,
    consequences: copy.moderateRemoveNote,
    confirmLabel: copy.confirmModerateRemove,
    cancelLabel: copy.cancelEdit,
    closeLabel: copy.cancelEdit,
    danger: true,
  });
  expect(harness.request).toHaveBeenCalledWith(
    `/api/content/${encodeURIComponent(slug)}/comments/${encodeURIComponent(comment.id)}`,
    "en",
    "DELETE",
    { expectedRevision: revision, reason: "Spam and off-topic" },
    expect.any(AbortSignal),
    expect.any(Function),
  );
  expect(harness.onSaved).toHaveBeenCalled();
});

it("skips moderator removal when confirmation is cancelled", async () => {
  seedModeratorRemove();
  confirmAction.mockResolvedValueOnce(false);
  await submit(render(false));
  expect(harness.request).not.toHaveBeenCalled();
  expect(harness.onSaved).not.toHaveBeenCalled();
});
