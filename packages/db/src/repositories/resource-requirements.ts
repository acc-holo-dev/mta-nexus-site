import {
  buildResourceRequirementsReport,
  NotFoundError,
  RESOURCE_REQUIREMENTS_MAX_DEPTH,
  RESOURCE_REQUIREMENTS_MAX_NODES,
  type ResourceRequirementNode,
  type ResourceRequirementsScope,
  requirementDeclarations,
} from "@nexus/domain";
import { eq, sql } from "drizzle-orm";
import { db } from "../client";
import { builds, products, resourceLibrarySelections as selections, users } from "../schema";
import { safePublishedBuildCondition } from "./build-safety";
import type { ResourceTransaction } from "./entitlements";
import {
  assertBuildModerationAuthority,
  assertProductMutationAuthority,
} from "./product-mutation-authority";
import { effectiveUserDownloadSources } from "./user-library";

type NodeRow = {
  id: string;
  slug: string;
  title: string;
  published: boolean;
  compatibility: unknown;
  accessible: boolean;
  selection: "latest" | "fixed" | "preview";
  buildId: string | null;
  version: string | null;
  sha256Hash: string | null;
  fileSizeBytes: number | null;
  safe: boolean;
  mtaTarget: string | null;
  packageStatus: string | null;
  manifestStatus: string | null;
  missingReferences: number;
  issueCount: number;
};
async function readNodes(
  tx: ResourceTransaction,
  userId: string,
  slugs: string[],
  privateRoot: string | null,
  library: boolean,
  observedAt: Date,
  buildId?: string,
) {
  const privateCondition = privateRoot ? sql`p.id = ${privateRoot}` : sql`false`;
  const rows = await tx.execute<NodeRow>(sql`${effectiveUserDownloadSources(userId, observedAt)}
 SELECT p.id,p.slug,left(p.title,200) AS title,p.status = 'published' AS published,p.compatibility,
 (${library} AND EXISTS (SELECT 1 FROM owned WHERE resource_id = p.id)) AS accessible,
 CASE WHEN ${privateCondition} THEN 'preview' WHEN pref.mode = 'fixed' THEN 'fixed' ELSE 'latest' END AS selection,
 chosen.id AS "buildId", chosen.version,chosen.sha256_hash AS "sha256Hash",chosen.file_size_bytes AS "fileSizeBytes",
 coalesce(chosen.status = 'published' AND chosen.scan_status = 'clean' AND btrim(chosen.scanner) <> '' AND chosen.scanned_at IS NOT NULL,false) AS safe,
 chosen.mta_version_target AS "mtaTarget",
 CASE WHEN chosen.package_evidence->>'sha256Hash' = chosen.sha256_hash AND chosen.package_evidence->>'fileSizeBytes' = chosen.file_size_bytes::text THEN chosen.package_evidence->>'status' END AS "packageStatus",
 chosen.package_evidence->>'manifestStatus' AS "manifestStatus",
 (SELECT count(*)::int FROM jsonb_array_elements(CASE WHEN jsonb_typeof(chosen.package_evidence->'manifest'->'references') = 'array' THEN chosen.package_evidence->'manifest'->'references' ELSE '[]'::jsonb END) entry WHERE entry->>'status' = 'missing') AS "missingReferences",
 CASE WHEN jsonb_typeof(chosen.package_evidence->'manifest'->'issues') = 'array' THEN jsonb_array_length(chosen.package_evidence->'manifest'->'issues') ELSE 0 END AS "issueCount"
 FROM ${products} p
 LEFT JOIN ${selections} pref ON pref.user_id = ${userId} AND pref.product_id = p.id AND ${library}
 LEFT JOIN LATERAL (SELECT * FROM ${builds} WHERE ${builds.productId} = p.id AND (${privateCondition} OR ${safePublishedBuildCondition(sql`p.id`)}) ORDER BY ${builds.createdAt} DESC,${builds.id} DESC LIMIT 1) latest ON true
 LEFT JOIN LATERAL (SELECT * FROM ${builds} WHERE ${builds.productId} = p.id AND
   (${privateCondition} OR ${safePublishedBuildCondition(sql`p.id`)}) AND
   ${builds.id} = CASE WHEN ${privateCondition} THEN coalesce(${buildId ?? null}::text,latest.id)
     WHEN pref.mode = 'fixed' THEN pref.build_id ELSE latest.id END
   LIMIT 1) chosen ON true
 WHERE p.slug IN (SELECT value FROM jsonb_array_elements_text(${JSON.stringify(slugs)}::jsonb))
 AND (${privateCondition} OR (p.status = 'published' AND p.price = 0 AND latest.id IS NOT NULL))
 ORDER BY p.slug`);
  return rows.map((row): ResourceRequirementNode => {
    const declarations = requirementDeclarations(row.compatibility),
      minimum = (row.compatibility as { mtaMinVersion?: unknown })?.mtaMinVersion;
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      published: row.published,
      dependencies: declarations.slugs,
      invalidDeclarations: declarations.invalid,
      minimumMta: typeof minimum === "string" && minimum.length <= 64 ? minimum : null,
      accessible: row.accessible,
      selection: row.selection,
      build: row.buildId
        ? {
            id: row.buildId,
            version: row.version ?? "",
            sha256Hash: row.sha256Hash ?? "",
            fileSizeBytes: row.fileSizeBytes ?? 0,
            safe: row.safe,
            mtaTarget: row.mtaTarget,
            packageStatus: row.packageStatus,
            manifestStatus: row.manifestStatus,
            missingReferences: row.missingReferences,
            issueCount: row.issueCount,
          }
        : null,
    };
  });
}
export class ResourceRequirementsRepository {
  async report(input: {
    actorId: string;
    productId: string;
    scope: ResourceRequirementsScope;
    targetMta?: string;
    buildId?: string;
  }) {
    return db.transaction(
      async (tx) => {
        const observedAt = new Date();
        await tx.execute(sql`set local statement_timeout = '10s'`);
        await tx.execute(sql`set local lock_timeout = '5s'`);
        const [product] = await tx
          .select({
            id: products.id,
            slug: products.slug,
            authorId: products.authorId,
            organizationId: products.organizationId,
            price: products.price,
          })
          .from(products)
          .where(eq(products.id, input.productId))
          .for("share")
          .limit(1);
        if (product?.price !== 0) throw new NotFoundError("Resource");
        if (input.scope === "library") {
          const [actor] = await tx
            .select({ id: users.id })
            .from(users)
            .where(eq(users.id, input.actorId))
            .for("share")
            .limit(1);
          if (!actor) throw new NotFoundError("Library account");
        }
        if (input.scope === "publisher")
          await assertProductMutationAuthority(tx, product, input.actorId);
        if (input.scope === "moderator") await assertBuildModerationAuthority(tx, input.actorId);
        const privateRoot = input.scope === "library" ? null : product.id;
        const nodes = await readNodes(
          tx,
          input.actorId,
          [product.slug],
          privateRoot,
          input.scope === "library",
          observedAt,
          input.buildId,
        );
        if (
          !nodes[0] ||
          (input.scope === "library" && !nodes[0].accessible) ||
          (input.buildId && !nodes[0].build)
        )
          throw new NotFoundError("Resource requirements");
        const discovered = new Set([product.slug]);
        let frontier = nodes[0].dependencies,
          truncated = false;
        for (let depth = 1; frontier.length && depth <= RESOURCE_REQUIREMENTS_MAX_DEPTH; depth++) {
          const next = [...new Set(frontier)].filter((slug) => !discovered.has(slug)).sort();
          if (next.length > RESOURCE_REQUIREMENTS_MAX_NODES - discovered.size) truncated = true;
          const batch = next.slice(0, RESOURCE_REQUIREMENTS_MAX_NODES - discovered.size);
          for (const slug of batch) discovered.add(slug);
          if (!batch.length) break;
          const layer = await readNodes(
            tx,
            input.actorId,
            batch,
            null,
            input.scope === "library",
            observedAt,
          );
          nodes.push(...layer);
          frontier = layer.flatMap((node) => node.dependencies);
        }
        if (frontier.some((slug) => !discovered.has(slug))) truncated = true;
        return buildResourceRequirementsReport({
          rootSlug: product.slug,
          nodes,
          targetMta: input.targetMta,
          scope: input.scope,
          generatedAt: observedAt.toISOString(),
          truncated,
        });
      },
      { isolationLevel: "repeatable read" },
    );
  }
}
export const resourceRequirementsRepository = new ResourceRequirementsRepository();
