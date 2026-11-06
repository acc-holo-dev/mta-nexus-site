import { AppError, NotFoundError, type Report } from "@nexus/domain";
import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { builds, comments, content, products, resourceQaThreads, servers, users } from "../schema";
import type { ResourceTransaction } from "../transaction";
import { safePublishedBuildCondition } from "./build-safety";

// Lock the public parent before its comment or build, as in their write paths.
export async function lockPublicReportTarget(
  tx: ResourceTransaction,
  type: Report["targetType"],
  id: string,
  actorId: string,
) {
  const missing = () => {
    throw new NotFoundError("Report target");
  };
  if (type === "review") return missing();
  async function product(id: string) {
    const [row] = await tx
      .select({ id: products.id, price: products.price })
      .from(products)
      .where(and(eq(products.id, id), eq(products.status, "published")))
      .for("share")
      .limit(1);
    if (!row) return missing();
    if (row.price === 0) {
      const [build] = await tx
        .select({ id: builds.id })
        .from(builds)
        .where(safePublishedBuildCondition(id))
        .for("share")
        .limit(1);
      if (!build) return missing();
    }
  }
  if (type === "product") return product(id);
  if (type === "resource_qa_thread") {
    const [thread] = await tx
      .select({
        id: resourceQaThreads.id,
        authorId: resourceQaThreads.authorId,
        productId: resourceQaThreads.productId,
      })
      .from(resourceQaThreads)
      .where(
        and(eq(resourceQaThreads.id, id), inArray(resourceQaThreads.status, ["open", "resolved"])),
      )
      .limit(1)
      .for("share");
    if (!thread) return missing();
    if (thread.authorId === actorId) throw new AppError("Own target", 422, "REPORT_OWN_TARGET");
    await product(thread.productId);
    return;
  }
  if (type === "server") {
    const [row] = await tx
      .select({ id: servers.id })
      .from(servers)
      .where(and(eq(servers.id, id), ne(servers.visibility, "private")))
      .for("share")
      .limit(1);
    if (!row) missing();
    return;
  }
  if (type === "user") {
    const [row] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, id))
      .for("share")
      .limit(1);
    if (!row) missing();
    return;
  }
  let contentId = id;
  if (type === "comment") {
    const [row] = await tx
      .select({ contentId: comments.contentId, productId: comments.productId })
      .from(comments)
      .where(eq(comments.id, id))
      .limit(1);
    // Product reviews have their own reporting workflow. Existing legacy
    // comment reports remain readable, but new ones must use that workflow.
    if (!row?.contentId || row.productId) return missing();
    contentId = row.contentId ?? "";
  }
  {
    const [row] = await tx
      .select({ id: content.id, authorId: content.authorId })
      .from(content)
      .where(and(eq(content.id, contentId), eq(content.status, "published")))
      .for("share")
      .limit(1);
    if (!row) return missing();
    if (type === "content" && row.authorId === actorId)
      throw new AppError("Own target", 422, "REPORT_OWN_TARGET");
  }
  if (type === "comment") {
    const [row] = await tx
      .select({ id: comments.id, authorId: comments.authorId })
      .from(comments)
      .where(
        and(eq(comments.id, id), eq(comments.contentId, contentId), isNull(comments.productId)),
      )
      .for("share")
      .limit(1);
    if (!row) missing();
    if (row?.authorId === actorId) throw new AppError("Own target", 422, "REPORT_OWN_TARGET");
  }
}
