import type { LibraryCollectionSnapshot } from "./library-collections";
import {
  buildResourceRequirementsReport,
  type ResourceRequirementNode,
} from "./resource-requirements";

export function buildCollectionRequirementsReport(input: {
  collection: LibraryCollectionSnapshot;
  itemCount: number;
  unavailableItemCount: number;
  rootSlugs: string[];
  nodes: ResourceRequirementNode[];
  targetMta?: string;
  generatedAt: string;
  truncated: boolean;
}) {
  const report = buildResourceRequirementsReport({
    rootSlug: input.rootSlugs[0] ?? "",
    rootSlugs: input.rootSlugs,
    nodes: input.nodes,
    targetMta: input.targetMta,
    scope: "library",
    generatedAt: input.generatedAt,
    truncated: input.truncated,
  });
  const state =
    input.itemCount === 0
      ? ("empty" as const)
      : input.unavailableItemCount > 0
        ? ("blocked" as const)
        : report.state;
  return {
    schemaVersion: 1 as const,
    collection: input.collection,
    itemCount: input.itemCount,
    unavailableItemCount: input.unavailableItemCount,
    rootSlugs: input.rootSlugs,
    state,
    // Do not suggest a whole-collection sequence if any member is withheld.
    report: {
      ...report,
      state: input.unavailableItemCount ? ("blocked" as const) : report.state,
      order: input.unavailableItemCount ? [] : report.order,
    },
  };
}
export type CollectionRequirementsReport = ReturnType<typeof buildCollectionRequirementsReport>;
