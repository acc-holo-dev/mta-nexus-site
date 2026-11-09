import { describe, it, expect } from "vitest";

// OPS-09 verification — deliberately failing unit test.
// Proves the required status check "CI result" blocks merges into main
// when CI is red. This file lives only on the scratch branch ops09-verify-red
// and is never merged to main.
describe("OPS-09 merge-gate verification", () => {
  it("intentionally fails so CI result turns red", () => {
    expect(true).toBe(false);
  });
});