import { expect, it, vi } from "vitest";
import {
  createVerificationApplicationsInteractionHelpers,
  mockReactHooks,
  nextRevision,
  response,
  revision,
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
  "submits edited evidence with the observed version and refreshes only after strict acknowledgement in %s",
  async (locale) => {
    const input = render(locale).find((node) => node.type === "textarea");
    if (!input) throw Error("Missing evidence field");
    (input.props.onChange as (event: { target: { value: string } }) => void)({
      target: { value: "Updated evidence" },
    });
    submit(render(locale));
    await vi.waitFor(() => expect(harness.refresh).toHaveBeenCalledTimes(1));
    const copy = verificationApplicationsCopy(locale);
    const labels = verificationCopy(locale);
    expect(confirmAction).toHaveBeenCalledWith(
      expect.objectContaining({
        title: copy.amend,
        object: "request",
        consequences: copy.confirm,
        confirmLabel: copy.amend,
        cancelLabel: labels.cancel,
        closeLabel: labels.cancel,
      }),
    );
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
  confirmAction.mockResolvedValueOnce(false);
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
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledTimes(1));
  submit(nodes);
  expect(harness.fetch).toHaveBeenCalledTimes(1);
  expect(render()[0].props["aria-busy"]).toBe(true);
  finish(response({ id: "request", status: "pending", revision: nextRevision }));
  await vi.waitFor(() => expect(harness.refresh).toHaveBeenCalledTimes(1));
});
