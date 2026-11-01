import {
  AppError,
  ForbiddenError,
  NotFoundError,
  type ResourceQaAnswerCommand,
  type ResourceQaAskCommand,
  type ResourceQaBuildContext,
  type ResourceQaCapabilities,
  type ResourceQaFollowCommand,
  type ResourceQaResolveCommand,
  type ResourceQaThreadDetail,
  type ResourceQaThreadSummary,
} from "@nexus/domain";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../client";
import {
  auditEvents,
  builds,
  organizationMembers,
  organizations,
  products,
  resourceQaAnswers,
  resourceQaThreadFollows,
  resourceQaThreads,
  users,
} from "../schema";
import { safePublishedBuildCondition } from "./build-safety";
import { lockUserDownloadAccess, type ResourceTransaction } from "./entitlements";
import { historyPageBounds } from "./history-pagination";

const invalid = (message = "Invalid Q&A command") =>
  new AppError(message, 400, "RESOURCE_QA_INVALID");
const changed = () => new AppError("Q&A thread changed; reload it", 409, "RESOURCE_QA_CHANGED");
const accessRequired = () =>
  new AppError("Current acquired access is required", 403, "RESOURCE_QA_ACCESS_REQUIRED");

type ProductRow = {
  id: string;
  title: string;
  slug: string;
  status: string;
  price: number;
  authorId: string;
  organizationId: string | null;
};

async function currentProduct(tx: ResourceTransaction, id: string, write = false) {
  const [product] = await tx
    .select({
      id: products.id,
      title: products.title,
      slug: products.slug,
      status: products.status,
      price: products.price,
      authorId: products.authorId,
      organizationId: products.organizationId,
    })
    .from(products)
    .where(eq(products.id, id))
    .limit(1)
    .for(write ? "no key update" : "share");
  if (!product) throw new NotFoundError("Resource", id);
  return product as ProductRow;
}

async function publiclyAvailable(tx: ResourceTransaction, product: Pick<ProductRow, "id" | "status">) {
  if (product.status !== "published") return false;
  const [build] = await tx
    .select({ id: builds.id })
    .from(builds)
    .where(safePublishedBuildCondition(product.id))
    .limit(1)
    .for("share");
  return Boolean(build);
}

async function isManagerOrStaff(
  tx: ResourceTransaction,
  product: Pick<ProductRow, "authorId" | "organizationId">,
  actorId: string,
) {
  const [actor] = await tx
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, actorId))
    .limit(1)
    .for("share");
  if (!actor) throw new ForbiddenError();
  if (actor.role === "admin" || actor.role === "moderator") return true;
  if (product.authorId === actorId) return true;
  if (!product.organizationId) return false;
  const [organization] = await tx
    .select({ ownerId: organizations.ownerId })
    .from(organizations)
    .where(eq(organizations.id, product.organizationId))
    .limit(1)
    .for("share");
  if (organization?.ownerId === actorId) return true;
  const [membership] = await tx
    .select({ role: organizationMembers.role, permissions: organizationMembers.permissions })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, product.organizationId),
        eq(organizationMembers.userId, actorId),
      ),
    )
    .limit(1)
    .for("share");
  return Boolean(
    membership &&
      (["owner", "admin"].includes(membership.role) ||
        membership.permissions.includes("manage_products")),
  );
}

async function canAsk(
  tx: ResourceTransaction,
  product: ProductRow,
  actorId: string | null,
): Promise<ResourceQaCapabilities["askReason"]> {
  if (!(await publiclyAvailable(tx, product))) return "resource_unavailable";
  if (!actorId) return "sign_in";
  if (product.price > 0) {
    const access = await lockUserDownloadAccess(tx, actorId, product.id);
    if (!access || (access.expiresAt && access.expiresAt.getTime() <= Date.now())) {
      const manages = await isManagerOrStaff(tx, product, actorId);
      if (!manages) return "access_required";
    }
  }
  return "ok";
}

function buildContext(
  versionLabel: string | null,
  available: boolean,
): ResourceQaBuildContext | null {
  if (!versionLabel) return null;
  return { version: versionLabel, available };
}

async function resolveBuildContext(
  tx: ResourceTransaction,
  productId: string,
  buildId: string | null,
  versionLabel: string | null,
): Promise<ResourceQaBuildContext | null> {
  if (!versionLabel) return null;
  if (!buildId) return buildContext(versionLabel, false);
  const [build] = await tx
    .select({ id: builds.id })
    .from(builds)
    .where(and(eq(builds.id, buildId), safePublishedBuildCondition(productId)))
    .limit(1)
    .for("share");
  return buildContext(versionLabel, Boolean(build));
}

async function audit(
  tx: ResourceTransaction,
  actorId: string,
  auditId: string,
  action: string,
  targetId: string,
  details: Record<string, unknown>,
  staff = false,
) {
  await tx.insert(auditEvents).values({
    id: auditId,
    actorId,
    actorType: staff ? "admin" : "user",
    action,
    targetType: "resource_qa_thread",
    targetId,
    details,
  });
}

function mapThread(
  row: {
    id: string;
    body: string;
    status: string;
    revision: number;
    resolvedAnswerId: string | null;
    createdAt: Date;
    updatedAt: Date | null;
    buildVersionLabel: string | null;
    username: string | null;
    displayName: string | null;
  },
  answerCount: number,
  context: ResourceQaBuildContext | null,
): ResourceQaThreadSummary {
  return {
    id: row.id,
    body: row.body,
    status: row.status as ResourceQaThreadSummary["status"],
    revision: row.revision,
    answerCount,
    buildContext: context,
    resolvedAnswerId: row.resolvedAnswerId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    author:
      row.username && row.displayName
        ? { username: row.username, displayName: row.displayName }
        : null,
  };
}

class ResourceQaRepository {
  async publicPage(productId: string, page = 1, actorId: string | null = null) {
    return db.transaction(
      async (tx) => {
        const product = await currentProduct(tx, productId);
        if (!(await publiclyAvailable(tx, product))) throw new NotFoundError("Resource", productId);
        const visible = and(
          eq(resourceQaThreads.productId, productId),
          inArray(resourceQaThreads.status, ["open", "resolved"]),
        );
        const [summary] = await tx.select({ total: count() }).from(resourceQaThreads).where(visible);
        const bounds = historyPageBounds(summary?.total ?? 0, page);
        const rows = await tx
          .select({
            id: resourceQaThreads.id,
            body: resourceQaThreads.body,
            status: resourceQaThreads.status,
            revision: resourceQaThreads.revision,
            resolvedAnswerId: resourceQaThreads.resolvedAnswerId,
            createdAt: resourceQaThreads.createdAt,
            updatedAt: resourceQaThreads.updatedAt,
            buildId: resourceQaThreads.buildId,
            buildVersionLabel: resourceQaThreads.buildVersionLabel,
            username: users.username,
            displayName: users.displayName,
            answerCount: sql<number>`(
              select count(*)::int from ${resourceQaAnswers}
              where ${resourceQaAnswers.threadId} = ${resourceQaThreads.id}
                and ${resourceQaAnswers.status} = 'published'
            )`,
          })
          .from(resourceQaThreads)
          .leftJoin(users, eq(users.id, resourceQaThreads.authorId))
          .where(visible)
          .orderBy(desc(resourceQaThreads.createdAt), desc(resourceQaThreads.id))
          .limit(bounds.pageSize)
          .offset(bounds.offset);

        const threads: ResourceQaThreadSummary[] = [];
        for (const row of rows) {
          const context = await resolveBuildContext(
            tx,
            productId,
            row.buildId,
            row.buildVersionLabel,
          );
          threads.push(mapThread(row, row.answerCount ?? 0, context));
        }

        const askReason = await canAsk(tx, product, actorId);
        const canManage = actorId ? await isManagerOrStaff(tx, product, actorId) : false;
        const capabilities: ResourceQaCapabilities = {
          canAsk: askReason === "ok",
          canAnswer: canManage,
          canResolve: canManage,
          askReason,
        };
        return { threads, capabilities, ...bounds };
      },
      { isolationLevel: "repeatable read" },
    );
  }

  async threadDetail(productId: string, threadId: string, actorId: string | null = null) {
    return db.transaction(
      async (tx) => {
        const product = await currentProduct(tx, productId);
        if (!(await publiclyAvailable(tx, product))) throw new NotFoundError("Resource", productId);
        const [row] = await tx
          .select({
            id: resourceQaThreads.id,
            body: resourceQaThreads.body,
            status: resourceQaThreads.status,
            revision: resourceQaThreads.revision,
            resolvedAnswerId: resourceQaThreads.resolvedAnswerId,
            createdAt: resourceQaThreads.createdAt,
            updatedAt: resourceQaThreads.updatedAt,
            buildId: resourceQaThreads.buildId,
            buildVersionLabel: resourceQaThreads.buildVersionLabel,
            username: users.username,
            displayName: users.displayName,
          })
          .from(resourceQaThreads)
          .leftJoin(users, eq(users.id, resourceQaThreads.authorId))
          .where(
            and(
              eq(resourceQaThreads.id, threadId),
              eq(resourceQaThreads.productId, productId),
              inArray(resourceQaThreads.status, ["open", "resolved"]),
            ),
          )
          .limit(1);
        if (!row) throw new NotFoundError("ResourceQaThread", threadId);

        const answers = await tx
          .select({
            id: resourceQaAnswers.id,
            body: resourceQaAnswers.body,
            status: resourceQaAnswers.status,
            revision: resourceQaAnswers.revision,
            createdAt: resourceQaAnswers.createdAt,
            updatedAt: resourceQaAnswers.updatedAt,
            username: users.username,
            displayName: users.displayName,
          })
          .from(resourceQaAnswers)
          .leftJoin(users, eq(users.id, resourceQaAnswers.authorId))
          .where(
            and(
              eq(resourceQaAnswers.threadId, threadId),
              eq(resourceQaAnswers.status, "published"),
            ),
          )
          .orderBy(asc(resourceQaAnswers.createdAt), asc(resourceQaAnswers.id));

        const [follow] = actorId
          ? await tx
              .select({
                enabled: resourceQaThreadFollows.enabled,
                revision: resourceQaThreadFollows.revision,
              })
              .from(resourceQaThreadFollows)
              .where(
                and(
                  eq(resourceQaThreadFollows.userId, actorId),
                  eq(resourceQaThreadFollows.threadId, threadId),
                ),
              )
              .limit(1)
          : [];

        const context = await resolveBuildContext(
          tx,
          productId,
          row.buildId,
          row.buildVersionLabel,
        );
        const summary = mapThread(row, answers.length, context);
        const detail: ResourceQaThreadDetail = {
          ...summary,
          answers: answers.map((answer) => ({
            id: answer.id,
            body: answer.body,
            status: answer.status as ResourceQaThreadDetail["answers"][number]["status"],
            revision: answer.revision,
            createdAt: answer.createdAt,
            updatedAt: answer.updatedAt,
            author:
              answer.username && answer.displayName
                ? { username: answer.username, displayName: answer.displayName }
                : null,
            isResolved: answer.id === row.resolvedAnswerId,
          })),
          following: Boolean(follow?.enabled),
          followRevision: follow?.revision ?? 0,
        };

        const askReason = await canAsk(tx, product, actorId);
        const canManage = actorId ? await isManagerOrStaff(tx, product, actorId) : false;
        return {
          thread: detail,
          capabilities: {
            canAsk: askReason === "ok",
            canAnswer: canManage,
            canResolve: canManage,
            askReason,
          } satisfies ResourceQaCapabilities,
        };
      },
      { isolationLevel: "repeatable read" },
    );
  }

  async ask(input: {
    actorId: string;
    productId: string;
    threadId: string;
    auditId: string;
    command: ResourceQaAskCommand;
  }) {
    const body = input.command.body?.trim() ?? "";
    if (body.length < 3 || body.length > 4000) throw invalid();
    return db.transaction(async (tx) => {
      const product = await currentProduct(tx, input.productId, true);
      const askReason = await canAsk(tx, product, input.actorId);
      if (askReason === "resource_unavailable") throw new NotFoundError("Resource", product.id);
      if (askReason === "access_required") throw accessRequired();
      if (askReason !== "ok") throw new ForbiddenError();

      let buildId: string | null = null;
      let buildVersionLabel: string | null = null;
      if (input.command.buildId) {
        const [build] = await tx
          .select({ id: builds.id, version: builds.version })
          .from(builds)
          .where(and(eq(builds.id, input.command.buildId), safePublishedBuildCondition(product.id)))
          .limit(1)
          .for("share");
        if (!build) throw invalid("Selected build is not a public version for this resource");
        buildId = build.id;
        buildVersionLabel = build.version;
      }

      await tx.insert(resourceQaThreads).values({
        id: input.threadId,
        productId: product.id,
        authorId: input.actorId,
        body,
        status: "open",
        revision: 1,
        buildId,
        buildVersionLabel,
      });
      await audit(tx, input.actorId, input.auditId, "resource.qa_asked", input.threadId, {
        productId: product.id,
        buildId,
        // Never audit private support text or download artifacts through Q&A.
        bodyLength: body.length,
      });
      return {
        id: input.threadId,
        revision: 1,
        status: "open" as const,
        buildContext: buildContext(buildVersionLabel, Boolean(buildId)),
      };
    });
  }

  async answer(input: {
    actorId: string;
    productId: string;
    threadId: string;
    answerId: string;
    auditId: string;
    command: ResourceQaAnswerCommand;
  }) {
    const body = input.command.body?.trim() ?? "";
    if (
      body.length < 3 ||
      body.length > 4000 ||
      !Number.isSafeInteger(input.command.expectedThreadRevision) ||
      input.command.expectedThreadRevision < 1
    ) {
      throw invalid();
    }
    return db.transaction(async (tx) => {
      const product = await currentProduct(tx, input.productId, true);
      if (!(await publiclyAvailable(tx, product))) throw new NotFoundError("Resource", product.id);
      if (!(await isManagerOrStaff(tx, product, input.actorId))) throw new ForbiddenError();

      const [thread] = await tx
        .select({
          id: resourceQaThreads.id,
          status: resourceQaThreads.status,
          revision: resourceQaThreads.revision,
        })
        .from(resourceQaThreads)
        .where(
          and(
            eq(resourceQaThreads.id, input.threadId),
            eq(resourceQaThreads.productId, product.id),
          ),
        )
        .limit(1)
        .for("update");
      if (!thread || thread.status === "removed") throw new NotFoundError("ResourceQaThread", input.threadId);
      if (thread.revision !== input.command.expectedThreadRevision) throw changed();

      await tx.insert(resourceQaAnswers).values({
        id: input.answerId,
        threadId: thread.id,
        authorId: input.actorId,
        body,
        status: "published",
        revision: 1,
      });
      const nextRevision = thread.revision + 1;
      await tx
        .update(resourceQaThreads)
        .set({ revision: nextRevision, updatedAt: new Date() })
        .where(eq(resourceQaThreads.id, thread.id));

      const [actor] = await tx
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, input.actorId))
        .limit(1);
      await audit(
        tx,
        input.actorId,
        input.auditId,
        "resource.qa_answered",
        thread.id,
        { answerId: input.answerId, bodyLength: body.length },
        actor?.role === "admin" || actor?.role === "moderator",
      );
      return {
        threadId: thread.id,
        answerId: input.answerId,
        threadRevision: nextRevision,
        answerRevision: 1,
      };
    });
  }

  async resolve(input: {
    actorId: string;
    productId: string;
    threadId: string;
    auditId: string;
    command: ResourceQaResolveCommand;
  }) {
    if (
      !Number.isSafeInteger(input.command.expectedRevision) ||
      input.command.expectedRevision < 1
    ) {
      throw invalid();
    }
    return db.transaction(async (tx) => {
      const product = await currentProduct(tx, input.productId, true);
      if (!(await publiclyAvailable(tx, product))) throw new NotFoundError("Resource", product.id);
      if (!(await isManagerOrStaff(tx, product, input.actorId))) throw new ForbiddenError();

      const [thread] = await tx
        .select({
          id: resourceQaThreads.id,
          status: resourceQaThreads.status,
          revision: resourceQaThreads.revision,
          resolvedAnswerId: resourceQaThreads.resolvedAnswerId,
        })
        .from(resourceQaThreads)
        .where(
          and(
            eq(resourceQaThreads.id, input.threadId),
            eq(resourceQaThreads.productId, product.id),
          ),
        )
        .limit(1)
        .for("update");
      if (!thread || thread.status === "removed") throw new NotFoundError("ResourceQaThread", input.threadId);
      if (thread.revision !== input.command.expectedRevision) throw changed();

      const [actor] = await tx
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, input.actorId))
        .limit(1);
      const staff = actor?.role === "admin" || actor?.role === "moderator";
      const nextRevision = thread.revision + 1;

      if (input.command.action === "reopen") {
        if (thread.status !== "resolved") throw invalid("Thread is not resolved");
        await tx
          .update(resourceQaThreads)
          .set({
            status: "open",
            resolvedAnswerId: null,
            resolvedAt: null,
            resolvedBy: null,
            revision: nextRevision,
            updatedAt: new Date(),
          })
          .where(eq(resourceQaThreads.id, thread.id));
        await audit(
          tx,
          input.actorId,
          input.auditId,
          "resource.qa_reopened",
          thread.id,
          {},
          staff,
        );
        return { threadId: thread.id, status: "open" as const, revision: nextRevision };
      }

      const [answer] = await tx
        .select({ id: resourceQaAnswers.id, status: resourceQaAnswers.status })
        .from(resourceQaAnswers)
        .where(
          and(
            eq(resourceQaAnswers.id, input.command.answerId),
            eq(resourceQaAnswers.threadId, thread.id),
          ),
        )
        .limit(1)
        .for("share");
      if (!answer || answer.status !== "published") throw invalid("Answer is not available");

      await tx
        .update(resourceQaThreads)
        .set({
          status: "resolved",
          resolvedAnswerId: answer.id,
          resolvedAt: new Date(),
          resolvedBy: input.actorId,
          revision: nextRevision,
          updatedAt: new Date(),
        })
        .where(eq(resourceQaThreads.id, thread.id));
      await audit(
        tx,
        input.actorId,
        input.auditId,
        "resource.qa_resolved",
        thread.id,
        { answerId: answer.id },
        staff,
      );
      return {
        threadId: thread.id,
        status: "resolved" as const,
        revision: nextRevision,
        resolvedAnswerId: answer.id,
      };
    });
  }

  async follow(input: {
    actorId: string;
    productId: string;
    threadId: string;
    auditId: string;
    command: ResourceQaFollowCommand;
  }) {
    if (
      !Number.isSafeInteger(input.command.expectedRevision) ||
      input.command.expectedRevision < 0
    ) {
      throw invalid();
    }
    const enabled = input.command.action === "follow";
    return db.transaction(async (tx) => {
      const product = await currentProduct(tx, input.productId, true);
      if (!(await publiclyAvailable(tx, product))) throw new NotFoundError("Resource", product.id);
      const [thread] = await tx
        .select({ id: resourceQaThreads.id, status: resourceQaThreads.status })
        .from(resourceQaThreads)
        .where(
          and(
            eq(resourceQaThreads.id, input.threadId),
            eq(resourceQaThreads.productId, product.id),
            inArray(resourceQaThreads.status, ["open", "resolved"]),
          ),
        )
        .limit(1)
        .for("share");
      if (!thread) throw new NotFoundError("ResourceQaThread", input.threadId);

      const [current] = await tx
        .select({
          enabled: resourceQaThreadFollows.enabled,
          revision: resourceQaThreadFollows.revision,
        })
        .from(resourceQaThreadFollows)
        .where(
          and(
            eq(resourceQaThreadFollows.userId, input.actorId),
            eq(resourceQaThreadFollows.threadId, thread.id),
          ),
        )
        .limit(1)
        .for("update");

      if ((current?.revision ?? 0) !== input.command.expectedRevision) throw changed();
      if (current && current.enabled === enabled) {
        return {
          threadId: thread.id,
          following: enabled,
          revision: current.revision,
          replayed: true as const,
        };
      }

      const nextRevision = (current?.revision ?? 0) + 1;
      if (!current) {
        await tx.insert(resourceQaThreadFollows).values({
          userId: input.actorId,
          threadId: thread.id,
          enabled,
          revision: nextRevision,
          updatedAt: new Date(),
        });
      } else {
        await tx
          .update(resourceQaThreadFollows)
          .set({ enabled, revision: nextRevision, updatedAt: new Date() })
          .where(
            and(
              eq(resourceQaThreadFollows.userId, input.actorId),
              eq(resourceQaThreadFollows.threadId, thread.id),
            ),
          );
      }
      await audit(tx, input.actorId, input.auditId, "resource.qa_thread_follow_changed", thread.id, {
        enabled,
        // Explicitly not a release watch and not a product bookmark.
        releaseWatch: false,
        productBookmark: false,
      });
      return {
        threadId: thread.id,
        following: enabled,
        revision: nextRevision,
        replayed: false as const,
      };
    });
  }
}

export const resourceQaRepository = new ResourceQaRepository();
