import { expect, it, vi } from "vitest";
import {
  ack,
  createManagedServerVisibilityInteractionHelpers,
  mockReactHooks,
  preview,
  response,
} from "../helpers/managed-server-visibility-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as (() => void)[],
  fetch: vi.fn(),
  refresh: vi.fn(),
  confirm: vi.fn(),
  reload: vi.fn(),
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));
vi.mock("../../src/components/confirm-action", () => ({
  confirmAction: (...args: unknown[]) => harness.confirm(...args),
}));

import { ManagedServerVisibilityBatch } from "../../src/components/managed-server-visibility-batch";
import { serverWorkspaceCopy } from "../../src/lib/server-workspace-copy";

const { render, hasCopy, click, commitBatch, selected, review } =
  createManagedServerVisibilityInteractionHelpers(harness, ManagedServerVisibilityBatch);

it.each(["preview", "write"])(
  "aborts requests on navigation and ignores late %s acknowledgements",
  async (stage) => {
    if (stage === "write") await review();
    let release: (value: Response) => void = () => {};
    harness.fetch.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );
    if (stage === "preview") {
      selected();
      click(render(), serverWorkspaceCopy("en").preview);
    } else await commitBatch(() => render(), serverWorkspaceCopy("en").confirm);
    const signal = harness.fetch.mock.calls.at(-1)?.[1].signal as AbortSignal;
    harness.cleanups.forEach((cleanup) => {
      cleanup?.();
    });
    expect(signal.aborted).toBe(true);
    release(response(stage === "preview" ? preview : ack));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(harness.refresh).not.toHaveBeenCalled();
    expect(render().some((node) => node.props.children === serverWorkspaceCopy("en").saved)).toBe(
      false,
    );
  },
);
it("retains confirmed success if refreshing the page fails", async () => {
  await review();
  harness.refresh.mockImplementationOnce(() => {
    throw Error("Refresh failed");
  });
  harness.fetch.mockResolvedValueOnce(response(ack));
  await commitBatch(() => render(), serverWorkspaceCopy("en").confirm);
  await vi.waitFor(() =>
    expect(render().some((node) => node.props.children === serverWorkspaceCopy("en").saved)).toBe(
      true,
    ),
  );
  expect(hasCopy(render(), serverWorkspaceCopy("en").unavailable)).toBe(true);
});
