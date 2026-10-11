export const RESOURCE_REQUIREMENTS_MAX_NODES = 48;
export const RESOURCE_REQUIREMENTS_MAX_DEPTH = 8;
export type ResourceRequirementsScope = "library" | "publisher" | "moderator";
export type ResourceRequirementNode = {
  id: string;
  slug: string;
  title: string;
  published: boolean;
  dependencies: string[];
  invalidDeclarations: boolean;
  minimumMta: string | null;
  accessible: boolean;
  selection: "latest" | "fixed" | "preview";
  build: {
    id: string;
    version: string;
    sha256Hash: string;
    fileSizeBytes: number;
    safe: boolean;
    mtaTarget: string | null;
    packageStatus: string | null;
    manifestStatus: string | null;
    missingReferences: number;
    issueCount: number;
  } | null;
};
export type ResourceRequirementIssue = {
  code:
    | "unavailable"
    | "missing_access"
    | "selection_unavailable"
    | "unsafe_build"
    | "invalid_declarations"
    | "mta_incompatible"
    | "mta_unknown"
    | "package_review"
    | "cycle"
    | "limit";
  slug: string;
};
export function requirementDeclarations(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return { slugs: [] as string[], invalid: true };
  const raw = (value as { dependencies?: unknown }).dependencies;
  if (raw === undefined) return { slugs: [] as string[], invalid: false };
  if (!Array.isArray(raw)) return { slugs: [] as string[], invalid: true };
  let invalid = raw.length > 25;
  const slugs: string[] = [];
  for (const item of raw.slice(0, 25)) {
    if (
      typeof item !== "string" ||
      item.length < 3 ||
      item.length > 120 ||
      !/^[a-z0-9][a-z0-9._-]*$/u.test(item)
    ) {
      invalid = true;
      continue;
    }
    if (!slugs.includes(item)) slugs.push(item);
  }
  return { slugs: slugs.sort(), invalid };
}
/** Compare declared sortable MTA versions, preserving unknown build precision. */
export function compareRequirementMta(
  target: string | undefined,
  minimum: string | null,
): "compatible" | "incompatible" | "unknown" {
  const valid = (value: string | null | undefined): value is string =>
    typeof value === "string" &&
    value.length <= 64 &&
    value.trim() === value &&
    /^1\.\d+(?:\.\d+)?(?:-\d+(?:\.\d+){1,2})?$/u.test(value);
  if (!valid(target) || !valid(minimum)) return "unknown";
  const [targetBase, targetBuild] = target.split("-"),
    [minBase, minBuild] = minimum.split("-");
  const compare = (a: string, b: string) => {
    const av = a.split("."),
      bv = b.split(".");
    for (let i = 0; i < Math.max(av.length, bv.length); i++) {
      const x = BigInt(av[i] ?? "0"),
        y = BigInt(bv[i] ?? "0");
      if (x !== y) return x > y ? 1 : -1;
    }
    return 0;
  };
  const base = compare(targetBase, minBase);
  if (base !== 0) return base > 0 ? "compatible" : "incompatible";
  if (minBuild && !targetBuild) return "unknown";
  return minBuild && compare(targetBuild ?? "0", minBuild) < 0 ? "incompatible" : "compatible";
}
export function buildResourceRequirementsReport(input: {
  rootSlug: string;
  nodes: ResourceRequirementNode[];
  targetMta?: string;
  scope: ResourceRequirementsScope;
  generatedAt: string;
  truncated: boolean;
}) {
  const bySlug = new Map(input.nodes.map((node) => [node.slug, node])),
    issues: ResourceRequirementIssue[] = [],
    order: string[] = [],
    cycles: string[][] = [];
  const active: string[] = [],
    visited = new Set<string>();
  let limited = input.truncated;
  function visit(slug: string, depth: number) {
    if (active.includes(slug)) {
      const cycle = [...active.slice(active.indexOf(slug)), slug];
      cycles.push(cycle);
      issues.push({ code: "cycle", slug });
      return;
    }
    if (visited.has(slug)) return;
    if (
      depth > RESOURCE_REQUIREMENTS_MAX_DEPTH ||
      visited.size >= RESOURCE_REQUIREMENTS_MAX_NODES
    ) {
      limited = true;
      return;
    }
    visited.add(slug);
    const node = bySlug.get(slug);
    if (!node) {
      issues.push({ code: "unavailable", slug });
      return;
    }
    if (node.invalidDeclarations) issues.push({ code: "invalid_declarations", slug });
    if (!node.build) issues.push({ code: "selection_unavailable", slug });
    else if (!node.published || !node.build.safe) issues.push({ code: "unsafe_build", slug });
    if (input.scope === "library" && !node.accessible)
      issues.push({ code: "missing_access", slug });
    const comparison = compareRequirementMta(input.targetMta, node.minimumMta);
    if (comparison !== "compatible")
      issues.push({
        code: comparison === "incompatible" ? "mta_incompatible" : "mta_unknown",
        slug,
      });
    if (
      node.build?.packageStatus !== "checked" ||
      node.build.manifestStatus !== "single" ||
      node.build.missingReferences > 0 ||
      node.build.issueCount > 0
    )
      issues.push({ code: "package_review", slug });
    active.push(slug);
    for (const dependency of node.dependencies) visit(dependency, depth + 1);
    active.pop();
    order.push(slug);
  }
  visit(input.rootSlug, 0);
  if (limited) issues.push({ code: "limit", slug: input.rootSlug });
  const blockers = issues.filter(
    (issue) => !["mta_unknown", "package_review"].includes(issue.code),
  );
  const downloadable = input.nodes.filter(
    (node) => visited.has(node.slug) && node.published && node.build?.safe && node.accessible,
  );
  return {
    schemaVersion: 1 as const,
    scope: input.scope,
    generatedAt: input.generatedAt,
    rootSlug: input.rootSlug,
    targetMta: input.targetMta ?? null,
    state: blockers.length
      ? ("blocked" as const)
      : issues.length
        ? ("review" as const)
        : ("ready" as const),
    truncated: limited,
    nodes: input.nodes
      .filter((node) => visited.has(node.slug))
      .sort((a, b) => a.slug.localeCompare(b.slug)),
    issues: [...new Map(issues.map((issue) => [`${issue.code}:${issue.slug}`, issue])).values()],
    cycles: [...new Map(cycles.map((cycle) => [cycle.join(":"), cycle])).values()],
    // Catalog order is advisory; slugs are not asserted to be installed MTA resource names.
    order:
      cycles.length || limited || issues.some((issue) => issue.code === "unavailable") ? [] : order,
    downloadableBytes: downloadable.reduce(
      (total, node) => total + (node.build?.fileSizeBytes ?? 0),
      0,
    ),
  };
}
export type ResourceRequirementsReport = ReturnType<typeof buildResourceRequirementsReport>;
