import { expect, it, vi } from "vitest";
import {
  createLibraryCollectionReconcileInteractionHelpers,
  mockReactHooks,
} from "../helpers/library-collection-reconcile-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
  cleanup: null as (() => void) | null,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));

import { LibraryCollectionReconcileForm } from "../../site/src/components/library-collection-reconcile";

const { render, check, submit, success } = createLibraryCollectionReconcileInteractionHelpers(
  harness,
  LibraryCollectionReconcileForm,
);

it.each([400, 401, 403, 404, 409, 413, 415])(
  "blocks stale mutation handlers after definitive status %s",
  async (status) => {
    check(1);
    check(2);
    const tree = render();
    harness.fetch.mockResolvedValueOnce({
      ok: false,
      status,
      json: async () => ({ code: "COLLECTION_CONFLICT" }),
    });
    await submit(tree);
    await submit(tree);
    expect(harness.fetch).toHaveBeenCalledOnce();
    expect(render().find((n) => n.type === "button")?.props.disabled).toBe(true);
  },
);

it("rejects mismatched addition/removal acknowledgements and retries only the original body", async () => {
  check(1);
  check(2);
  harness.fetch.mockImplementationOnce(async (_url: string, init: RequestInit) => {
    const body = await success(init).json();
    body.receipt.command.removeProductIds = ["prd_other"];
    return { ok: true, json: async () => body };
  });
  await submit();
  expect(harness.refresh).not.toHaveBeenCalled();
  const init = harness.fetch.mock.calls[0]?.[1] as RequestInit;
  harness.fetch.mockResolvedValueOnce(success(init));
  await submit();
  expect(harness.refresh).toHaveBeenCalledOnce();
});
