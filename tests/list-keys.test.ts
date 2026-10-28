import { describe, expect, it } from "vitest";
import { withOccurrenceKeys } from "../packages/ui/src/list-keys";

const keyed = (items: string[]) => withOccurrenceKeys(items, (item) => item);

describe("value-list occurrence keys", () => {
  it("preserves duplicate and empty values without key collisions", () => {
    const input = ["", "same", "same", "", "same-1", '["same",1]'];
    const result = keyed(input);
    expect(result.map(({ item }) => item)).toEqual(input);
    expect(new Set(result.map(({ key }) => key)).size).toBe(input.length);
    expect(keyed(input)).toEqual(result);
  });

  it("keeps keys when unrelated values are inserted, removed or reordered", () => {
    const before = keyed(["alpha", "beta", "alpha"]);
    const after = keyed(["new", "beta", "alpha", "alpha"]);
    expect(after.filter(({ item }) => item === "alpha")).toEqual(
      before.filter(({ item }) => item === "alpha"),
    );
    expect(after.find(({ item }) => item === "beta")).toEqual(before[1]);
    expect(keyed(["beta"])[0]).toEqual(before[1]);
  });

  it("distinguishes record variants and keeps identical declarations", () => {
    const declarations = [
      { name: "function.fetchRemote", access: "true" },
      { name: "function.fetchRemote", access: "false" },
      { name: "function.fetchRemote", access: "true" },
    ];
    const result = withOccurrenceKeys(declarations, (entry) =>
      JSON.stringify([entry.name, entry.access]),
    );
    expect(new Set(result.map(({ key }) => key)).size).toBe(3);
    expect(result.map(({ item }) => item)).toEqual(declarations);
    expect(declarations[0]).toEqual({ name: "function.fetchRemote", access: "true" });
    expect(keyed([])).toEqual([]);
  });
});
