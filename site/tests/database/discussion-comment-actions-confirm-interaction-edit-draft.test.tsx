import { expect, it, vi } from "vitest";
import {
  createDiscussionCommentActionsConfirmInteractionHelpers,
  mockReactHooks,
} from "../helpers/discussion-comment-actions-confirm-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  request: vi.fn(),
  onPending: vi.fn(),
  onSaved: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../../src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("../../src/lib/user-platform-client", async (original) => {
  const actual = await original<typeof import("../../src/lib/user-platform-client")>();
  return {
    ...actual,
    platformRequest: harness.request,
  };
});

import { DiscussionCommentActions } from "../../src/components/discussion-comment-actions";
import { getDiscussionCopy } from "../../src/lib/content-discussion-copy";

const { render, control, submit } = createDiscussionCommentActionsConfirmInteractionHelpers(
  harness,
  DiscussionCommentActions,
  confirmAction,
);

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
