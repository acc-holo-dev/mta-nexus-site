import { expect, it, vi } from "vitest";
import {
  createVerificationApplicationsInteractionHelpers,
  mockReactHooks,
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
vi.mock("../apps/web/src/components/confirm-action", () => ({
  confirmAction,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));
vi.mock("../apps/web/src/components/locale-context", async () => {
  const { getDictionary } = await import("../apps/web/src/lib/i18n");
  return { useNexusLocale: () => ({ locale: "en", dictionary: getDictionary("en") }) };
});

import { VerificationApplicationAmend } from "../apps/web/src/components/verification-application-amend";
import { VerificationModerationControls } from "../apps/web/src/components/verification-moderation-controls";
import { verificationApplicationsCopy } from "../apps/web/src/lib/verification-applications-copy";
import { verificationCopy } from "../apps/web/src/lib/verification-workspace-copy";

const { render, submit } = createVerificationApplicationsInteractionHelpers(
  harness,
  VerificationApplicationAmend,
  VerificationModerationControls,
  confirmAction,
);

it.each(["en", "ru"] as const)(
  "asks for confirmation before verification amend PATCH in %s",
  async (locale) => {
    const copy = verificationApplicationsCopy(locale);
    const labels = verificationCopy(locale);
    submit(render(locale));
    await vi.waitFor(() => expect(confirmAction).toHaveBeenCalledTimes(1));
    expect(confirmAction).toHaveBeenCalledWith({
      title: copy.amend,
      object: "request",
      consequences: copy.confirm,
      confirmLabel: copy.amend,
      cancelLabel: labels.cancel,
      closeLabel: labels.cancel,
    });
    expect(harness.fetch).toHaveBeenCalledOnce();
    expect(harness.fetch.mock.calls[0][1]).toMatchObject({ method: "PATCH" });
  },
);

it("skips verification amend when confirmation is cancelled", async () => {
  confirmAction.mockResolvedValueOnce(false);
  submit();
  await vi.waitFor(() => expect(confirmAction).toHaveBeenCalledTimes(1));
  expect(harness.fetch).not.toHaveBeenCalled();
  expect(harness.refresh).not.toHaveBeenCalled();
});
