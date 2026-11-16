import {
  buildCollectionRequirementsReport as report,
  type ResourceRequirementNode,
} from "@nexus/domain";
import { expect, it } from "vitest";
const node = (slug: string, dependencies: string[] = []): ResourceRequirementNode => ({
  id: `prd_${slug}`,
  slug,
  title: slug,
  published: true,
  dependencies,
  invalidDeclarations: false,
  minimumMta: "1.6.0",
  accessible: true,
  selection: "latest",
  build: {
    id: `bld_${slug}`,
    version: "1",
    sha256Hash: "a".repeat(64),
    fileSizeBytes: 10,
    safe: true,
    mtaTarget: null,
    packageStatus: "checked",
    manifestStatus: "single",
    missingReferences: 0,
    issueCount: 0,
  },
});
const input = {
  collection: { id: "lcol_a", name: "Core", status: "active" as const, revision: 3 },
  itemCount: 2,
  unavailableItemCount: 0,
  rootSlugs: ["aaa", "bbb"],
  targetMta: "1.6.0",
  generatedAt: "2026-10-11T00:00:00Z",
  truncated: false,
};
it("deduplicates shared dependencies, selected bytes and acquisition order across roots", () => {
  const result = report({
    ...input,
    nodes: [node("aaa", ["shared"]), node("bbb", ["shared"]), node("shared")],
  });
  expect(result.state).toBe("ready");
  expect(result.report.order).toEqual(["shared", "aaa", "bbb"]);
  expect(result.report.downloadableBytes).toBe(30);
  expect(result.report.nodes).toHaveLength(3);
});
it("blocks unavailable collection members without inventing private identities", () => {
  const result = report({
    ...input,
    rootSlugs: ["aaa"],
    unavailableItemCount: 1,
    nodes: [node("aaa")],
  });
  expect(result.state).toBe("blocked");
  expect(result.report.order).toEqual([]);
  expect(result.report.nodes.map((n) => n.slug)).toEqual(["aaa"]);
});
it("distinguishes an empty collection from a collection with all access revoked", () => {
  expect(report({ ...input, itemCount: 0, rootSlugs: [], nodes: [] }).state).toBe("empty");
  expect(report({ ...input, rootSlugs: [], nodes: [], unavailableItemCount: 2 }).state).toBe(
    "blocked",
  );
});
it("finds cycles spanning two collection roots", () => {
  const result = report({ ...input, nodes: [node("aaa", ["bbb"]), node("bbb", ["aaa"])] });
  expect(result.state).toBe("blocked");
  expect(result.report.cycles).toEqual([["aaa", "bbb", "aaa"]]);
  expect(result.report.order).toEqual([]);
});
it("checks disconnected roots and preserves failed pins without falling back", () => {
  const result = report({
    ...input,
    nodes: [node("aaa"), { ...node("bbb"), selection: "fixed", build: null }],
  });
  expect(result.state).toBe("blocked");
  expect(result.report.issues).toContainEqual({ code: "selection_unavailable", slug: "bbb" });
  expect(result.report.downloadableBytes).toBe(10);
});
it("bounds incomplete collections and does not present a complete order", () => {
  const result = report({ ...input, truncated: true, nodes: [node("aaa"), node("bbb")] });
  expect(result.state).toBe("blocked");
  expect(result.report.truncated).toBe(true);
  expect(result.report.order).toEqual([]);
});
it("requires review for unknown MTA precision on any root", () => {
  const result = report({
    ...input,
    nodes: [node("aaa"), { ...node("bbb"), minimumMta: "1.6.0-9.22279.0" }],
  });
  expect(result.state).toBe("review");
  expect(result.report.issues).toContainEqual({ code: "mta_unknown", slug: "bbb" });
});
it("does not count inaccessible dependency bytes", () => {
  const result = report({
    ...input,
    nodes: [node("aaa", ["shared"]), node("bbb"), { ...node("shared"), accessible: false }],
  });
  expect(result.state).toBe("blocked");
  expect(result.report.downloadableBytes).toBe(20);
  expect(result.report.issues).toContainEqual({ code: "missing_access", slug: "shared" });
});
