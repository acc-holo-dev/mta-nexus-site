import { expect, it, vi } from "vitest";
import {
  createLibraryCollectionItemCopyInteractionHelpers,
  mockReactHooks,
} from "../helpers/library-collection-item-copy-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
  reload: vi.fn(),
  cleanup: null as (() => void) | null,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));

import { LibraryCollectionItemCopyForm } from "../../site/src/components/library-collection-item-copy";
import { libraryCollectionsCopy } from "../../site/src/lib/library-collections-i18n";

const { state, firstDestination, render, choose, check, submit, success } =
  createLibraryCollectionItemCopyInteractionHelpers(harness, LibraryCollectionItemCopyForm);

it.each(["en", "ru"] as const)(
  "requires reviewed selections and retains both collection revisions after response loss in %s",
  async (value) => {
    state.locale = value;
    choose();
    check(0);
    check(1);
    await submit();
    expect(harness.fetch).not.toHaveBeenCalled();
    check(2);
    harness.fetch.mockRejectedValueOnce(new Error("lost"));
    await submit();
    const [url, init] = harness.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/library/collections/lcol_target");
    expect(JSON.parse(String(init.body))).toMatchObject({
      action: "copy-items",
      sourceCollectionId: "lcol_source",
      expectedSourceRevision: 4,
      expectedRevision: 2,
      productIds: ["prd_a", "prd_b"],
    });
    state.source = { ...state.source, id: "lcol_other_source", revision: 9 };
    state.destinations = [{ ...firstDestination(), id: "lcol_other_target", revision: 9 }];
    harness.fetch.mockResolvedValueOnce(success(init));
    await submit();
    expect(harness.fetch.mock.calls[1][0]).toBe(url);
    expect(harness.fetch.mock.calls[1][1].body).toBe(init.body);
    expect(
      render().some(
        (n) =>
          n.props.role === "status" &&
          n.props.children === libraryCollectionsCopy(state.locale).saved,
      ),
    ).toBe(true);
    expect(render().find((n) => n.type === "a")?.props.href).toBe(
      "/workspace/library/collections/lcol_target",
    );
  },
);
