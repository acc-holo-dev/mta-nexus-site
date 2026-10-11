import {
  compareRequirementMta as compare,
  type ResourceRequirementNode,
  buildResourceRequirementsReport as report,
  requirementDeclarations,
} from "@nexus/domain";
import { expect, it } from "vitest";

function node(slug: string, dependencies: string[] = []): ResourceRequirementNode {
  return {
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
      version: "1.0",
      sha256Hash: "a".repeat(64),
      fileSizeBytes: 16,
      safe: true,
      mtaTarget: null,
      packageStatus: "checked",
      manifestStatus: "single",
      missingReferences: 0,
      issueCount: 0,
    },
  };
}
const input = {
  rootSlug: "root",
  scope: "library" as const,
  generatedAt: "2026-10-11T00:00:00Z",
  targetMta: "1.6.0",
  truncated: false,
};
it("orders transitive and shared dependencies once before their parents", () => {
  const result = report({
    ...input,
    nodes: [
      node("root", ["bbb", "aaa"]),
      node("aaa", ["shared"]),
      node("bbb", ["shared"]),
      node("shared"),
    ],
  });
  expect(result.state).toBe("ready");
  expect(result.order).toEqual(["shared", "bbb", "aaa", "root"]);
  expect(result.downloadableBytes).toBe(64);
});
it("detects cycles without returning a false installation order", () => {
  const result = report({ ...input, nodes: [node("root", ["aaa"]), node("aaa", ["root"])] });
  expect(result.state).toBe("blocked");
  expect(result.cycles).toEqual([["root", "aaa", "root"]]);
  expect(result.order).toEqual([]);
});
it("masks unresolved resources behind declared slugs", () => {
  const result = report({ ...input, nodes: [node("root", ["private-resource"])] });
  expect(result.issues).toEqual([{ code: "unavailable", slug: "private-resource" }]);
  expect(result.order).toEqual([]);
  expect(result.nodes).toHaveLength(1);
});
it("reports missing access without granting or counting its file bytes", () => {
  const dependency = { ...node("aaa"), accessible: false };
  const result = report({ ...input, nodes: [node("root", ["aaa"]), dependency] });
  expect(result.state).toBe("blocked");
  expect(result.downloadableBytes).toBe(16);
  expect(result.issues).toContainEqual({ code: "missing_access", slug: "aaa" });
});
it("treats a missing pinned build as unavailable without silently switching to latest", () => {
  const result = report({
    ...input,
    nodes: [{ ...node("root"), selection: "fixed", build: null }],
  });
  expect(result.state).toBe("blocked");
  expect(result.issues).toContainEqual({ code: "selection_unavailable", slug: "root" });
});
it("does not evaluate buyer grants in publisher previews", () => {
  const result = report({
    ...input,
    scope: "publisher",
    nodes: [{ ...node("root"), accessible: false }],
  });
  expect(result.state).toBe("ready");
  expect(result.issues.some((v) => v.code === "missing_access")).toBe(false);
});
it("flags withdrawn or unsafe preview builds", () => {
  const result = report({
    ...input,
    scope: "moderator",
    nodes: [{ ...node("root"), published: false }],
  });
  expect(result.issues).toContainEqual({ code: "unsafe_build", slug: "root" });
  expect(result.state).toBe("blocked");
});
it("keeps absent or structurally uninspected package evidence uncertain", () => {
  const base = node("root");
  if (!base.build) throw new Error("Expected build");
  const result = report({
    ...input,
    nodes: [{ ...base, build: { ...base.build, packageStatus: null, manifestStatus: null } }],
  });
  expect(result.state).toBe("review");
  expect(result.issues).toContainEqual({ code: "package_review", slug: "root" });
});
it("bounds deep chains and explicitly marks incomplete graphs", () => {
  const nodes = Array.from({ length: 20 }, (_, i) =>
    node(i === 0 ? "root" : `node${i}`, i < 19 ? [`node${i + 1}`] : []),
  );
  const result = report({ ...input, nodes });
  expect(result.truncated).toBe(true);
  expect(result.order).toEqual([]);
  expect(result.nodes.length).toBeLessThanOrEqual(9);
});
it("bounds wide graphs, including unresolved declarations", () => {
  const children = Array.from({ length: 25 }, (_, i) => `dep${i}`);
  const nodes = [
    node("root", children),
    ...children.map((slug) =>
      node(
        slug,
        Array.from({ length: 25 }, (_, i) => `${slug}_${i}`),
      ),
    ),
  ];
  const result = report({ ...input, nodes });
  expect(result.truncated).toBe(true);
  expect(result.state).toBe("blocked");
  expect(result.issues.length).toBeLessThanOrEqual(100);
});
it("does not include disconnected private nodes", () => {
  const result = report({ ...input, nodes: [node("root"), node("secret")] });
  expect(result.nodes.map((v) => v.slug)).toEqual(["root"]);
});
it.each([
  ["1.6.0", "1.5.9", "compatible"],
  ["1.5.9", "1.6.0", "incompatible"],
  ["1.6", "1.6.0", "compatible"],
  ["1.6.0", "1.6.0-9.22279.0", "unknown"],
  ["1.6.0-9.22278.0", "1.6.0-9.22279.0", "incompatible"],
  ["1.6.0-9.22279.0", "1.6.0-9.22279.0", "compatible"],
  ["1.7.0", "1.6.0-9.22279.0", "compatible"],
  ["1.6.0\n", "1.6.0", "unknown"],
  ["999", "1.6.0", "unknown"],
  ["1.6.0", null, "unknown"],
])("compares target %s and minimum %s as %s", (target, minimum, expected) => {
  expect(compare(target, minimum)).toBe(expected);
});
it("refuses malformed legacy declarations rather than declaring a complete dependency-free graph", () => {
  for (const value of [
    null,
    [],
    "unknown",
    { dependencies: "abc" },
    { dependencies: ["aaa", "../../private"] },
  ])
    expect(requirementDeclarations(value).invalid).toBe(true);
  expect(requirementDeclarations({ dependencies: ["bbb", "aaa", "bbb"] })).toEqual({
    slugs: ["aaa", "bbb"],
    invalid: false,
  });
});
