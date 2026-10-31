import {
  AppError,
  ForbiddenError,
  NotFoundError,
  type ServerReviewCommand,
  type ServerReviewModeration,
  type ServerReviewView,
  serverReviewEligibility,
} from "@nexus/domain";
import { and, count, desc, eq } from "drizzle-orm";
import { db } from "../client";
import {
  auditEvents,
  follows,
  organizationMembers,
  organizations,
  serverReviews,
  servers,
  users,
} from "../schema";
import type { ResourceTransaction } from "./entitlements";
import { historyPageBounds } from "./history-pagination";

const conflict = () => new AppError("Review changed; reload it", 409, "REVIEW_CHANGED");

const publicFields = {
  id: serverReviews.id,
  text: serverReviews.text,
  rating: serverReviews.rating,
  status: serverReviews.status,
  revision: serverReviews.revision,
  interactionSource: serverReviews.interactionSource,
  createdAt: serverReviews.createdAt,
  updatedAt: serverReviews.updatedAt,
  author: { username: users.username, displayName: users.displayName },
};

type ServerRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  visibility: string;
  ownerId: string | null;
  organizationId: string | null;
};

async function publicServer(tx: ResourceTransaction, serverId: string, write = false) {
  const [server] = await tx
    .select({
      id: servers.id,
      slug: servers.slug,
      name: servers.name,
      status: servers.status,
      visibility: servers.visibility,
      ownerId: servers.ownerId,
      organizationId: servers.organizationId,
    })
    .from(servers)
    .where(eq(servers.id, serverId))
    .limit(1)
    .for(write ? "no key update" : "share");
  if (!server) throw new NotFoundError("Server", serverId);
  if (server.visibility !== "public" || server.status !== "active") {
    throw new NotFoundError("Server", serverId);
  }
  return server as ServerRow;
}

async function ownsServer(tx: ResourceTransaction, server: ServerRow, actorId: string) {
  if (server.ownerId === actorId) return true;
  if (!server.organizationId) return false;
  const [organization] = await tx
    .select({ ownerId: organizations.ownerId })
    .from(organizations)
    .where(eq(organizations.id, server.organizationId))
    .limit(1)
    .for("share");
  if (organization?.ownerId === actorId) return true;
  const [membership] = await tx
    .select({ role: organizationMembers.role, permissions: organizationMembers.permissions })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, server.organizationId),
        eq(organizationMembers.userId, actorId),
      ),
    )
    .limit(1)
    .for("share");
  return Boolean(
    membership &&
      (["owner", "admin"].includes(membership.role) ||
        membership.permissions.includes("manage_servers")),
  );
}

async function followingServer(tx: ResourceTransaction, actorId: string, serverId: string) {
  const [follow] = await tx
    .select({ id: follows.id })
    .from(follows)
    .where(
      and(
        eq(follows.followerId, actorId),
        eq(follows.targetType, "server"),
        eq(follows.targetId, serverId),
      ),
    )
    .limit(1)
    .for("share");
  return Boolean(follow);
}

async function audit(
  tx: ResourceTransaction,
  actorId: string,
  auditId: string,
  action: string,
  reviewId: string,
  details: Record<string, unknown>,
  staff = false,
) {
  await tx.insert(auditEvents).values({
    id: auditId,
    actorId,
    actorType: staff ? "admin" : "user",
    action,
    targetType: "server_review",
    targetId: reviewId,
    details,
  });
}

class ServerReviewsRepository {
  async publicPage(serverId: string, page = 1) {
    return db.transaction(
      async (tx) => {
        await publicServer(tx, serverId);
        const [summary] = await tx
          .select({ total: count() })
          .from(serverReviews)
          .where(and(eq(serverReviews.serverId, serverId), eq(serverReviews.status, "published")));
        const bounds = historyPageBounds(summary?.total ?? 0, page);
        const reviews = await tx
          .select(publicFields)
          .from(serverReviews)
          .leftJoin(users, eq(users.id, serverReviews.authorId))
          .where(and(eq(serverReviews.serverId, serverId), eq(serverReviews.status, "published")))
          .orderBy(desc(serverReviews.createdAt), desc(serverReviews.id))
          .limit(bounds.pageSize)
          .offset(bounds.offset);
        return { reviews: reviews as ServerReviewView[], ...bounds };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

  async ownDetail(actorId: string, serverId: string) {
    return db.transaction(
      async (tx) => {
        const server = await publicServer(tx, serverId);
        const [review] = await tx
          .select({
            ...publicFields,
            moderationReason: serverReviews.moderationReason,
          })
          .from(serverReviews)
          .leftJoin(users, eq(users.id, serverReviews.authorId))
          .where(and(eq(serverReviews.serverId, serverId), eq(serverReviews.authorId, actorId)))
          .limit(1);
        const following = await followingServer(tx, actorId, serverId);
        const owns = await ownsServer(tx, server, actorId);
        const gate = serverReviewEligibility({
          following,
          ownsServer: owns,
          removed: review?.status === "removed",
        });
        return {
          server: { id: server.id, slug: server.slug, name: server.name },
          review: review
            ? ({
                ...review,
                status: review.status as ServerReviewView["status"],
                interactionSource:
                  review.interactionSource as ServerReviewView["interactionSource"],
              } as ServerReviewView & { moderationReason: string | null })
            : null,
          canReview: gate.eligible,
          eligibility: gate.reason,
        };
      },
      { isolationLevel: "repeatable read" },
    );
  }

  async command(input: {
    actorId: string;
    serverId: string;
    reviewId: string;
    auditId: string;
    command: ServerReviewCommand;
  }) {
    const command = input.command;
    if (
      !["save", "withdraw"].includes(command.action) ||
      !Number.isSafeInteger(command.expectedRevision) ||
      command.expectedRevision < 0 ||
      command.expectedRevision >= 2147483647 ||
      (command.action === "save" &&
        (typeof command.text !== "string" ||
          !Number.isInteger(command.rating) ||
          command.rating < 1 ||
          command.rating > 5 ||
          command.text.trim().length < 3 ||
          command.text.length > 4000))
    ) {
      throw new AppError("Invalid review", 400, "REVIEW_INVALID");
    }

    return db.transaction(async (tx) => {
      const server = await publicServer(tx, input.serverId, true);
      const following = await followingServer(tx, input.actorId, server.id);
      const owns = await ownsServer(tx, server, input.actorId);
      const [current] = await tx
        .select({
          id: serverReviews.id,
          status: serverReviews.status,
          revision: serverReviews.revision,
        })
        .from(serverReviews)
        .where(
          and(eq(serverReviews.serverId, server.id), eq(serverReviews.authorId, input.actorId)),
        )
        .limit(1)
        .for("update");

      if ((current?.revision ?? 0) !== command.expectedRevision) throw conflict();
      if (current?.status === "removed") {
        throw new AppError("Removed reviews cannot be republished", 409, "REVIEW_MODERATED");
      }

      if (command.action === "withdraw") {
        if (!current) throw new NotFoundError("Review");
        if (current.status === "withdrawn") {
          return { id: current.id, revision: current.revision, status: "withdrawn" as const };
        }
        await tx
          .update(serverReviews)
          .set({
            status: "withdrawn",
            revision: current.revision + 1,
            updatedAt: new Date(),
          })
          .where(eq(serverReviews.id, current.id));
        await audit(tx, input.actorId, input.auditId, "server.review_withdrawn", current.id, {
          serverId: server.id,
        });
        return { id: current.id, revision: current.revision + 1, status: "withdrawn" as const };
      }

      const gate = serverReviewEligibility({
        following,
        ownsServer: owns,
        removed: false,
      });
      if (!gate.eligible) {
        throw new AppError(
          gate.reason === "owner_conflict"
            ? "Server operators cannot review their own server"
            : "Verified server interaction is required",
          403,
          "REVIEW_ACCESS_REQUIRED",
        );
      }

      const values = {
        text: command.text.trim(),
        rating: command.rating,
        status: "published" as const,
        interactionSource: "follow" as const,
        revision: (current?.revision ?? 0) + 1,
        updatedAt: new Date(),
      };

      if (current) {
        await tx.update(serverReviews).set(values).where(eq(serverReviews.id, current.id));
      } else {
        await tx.insert(serverReviews).values({
          id: input.reviewId,
          serverId: server.id,
          authorId: input.actorId,
          ...values,
        });
      }

      // Re-check follow before audit so concurrent unfollow cannot leave a published review.
      if (!(await followingServer(tx, input.actorId, server.id))) {
        throw new AppError(
          "Verified server interaction is required",
          403,
          "REVIEW_ACCESS_REQUIRED",
        );
      }

      const reviewId = current?.id ?? input.reviewId;
      await audit(
        tx,
        input.actorId,
        input.auditId,
        current ? "server.review_edited" : "server.review_submitted",
        reviewId,
        { serverId: server.id, rating: values.rating, interactionSource: "follow" },
      );

      const [review] = await tx
        .select(publicFields)
        .from(serverReviews)
        .leftJoin(users, eq(users.id, serverReviews.authorId))
        .where(eq(serverReviews.id, reviewId))
        .limit(1);

      return {
        id: reviewId,
        revision: values.revision,
        status: "published" as const,
        review: review as ServerReviewView,
      };
    });
  }

  async moderate(input: {
    actorId: string;
    reviewId: string;
    auditId: string;
    command: ServerReviewModeration;
  }) {
    if (
      input.command.action !== "remove" ||
      !Number.isSafeInteger(input.command.expectedRevision) ||
      input.command.expectedRevision < 1 ||
      typeof input.command.notes !== "string" ||
      input.command.notes.trim().length < 3 ||
      input.command.notes.length > 2000
    ) {
      throw new AppError("Invalid moderation decision", 400, "REVIEW_INVALID");
    }

    return db.transaction(async (tx) => {
      const [actor] = await tx
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, input.actorId))
        .limit(1)
        .for("share");
      if (!actor || !["admin", "moderator"].includes(actor.role)) throw new ForbiddenError();

      const [current] = await tx
        .select({
          id: serverReviews.id,
          serverId: serverReviews.serverId,
          status: serverReviews.status,
          revision: serverReviews.revision,
        })
        .from(serverReviews)
        .where(eq(serverReviews.id, input.reviewId))
        .limit(1)
        .for("update");
      if (!current) throw new NotFoundError("Review", input.reviewId);
      if (current.revision !== input.command.expectedRevision) throw conflict();
      if (current.status === "removed") {
        return { id: current.id, revision: current.revision, status: "removed" as const };
      }

      const notes = input.command.notes.trim();
      await tx
        .update(serverReviews)
        .set({
          status: "removed",
          revision: current.revision + 1,
          moderationReason: notes,
          updatedAt: new Date(),
        })
        .where(eq(serverReviews.id, current.id));
      await audit(
        tx,
        input.actorId,
        input.auditId,
        "server.review_removed",
        current.id,
        { serverId: current.serverId, notes },
        true,
      );
      return { id: current.id, revision: current.revision + 1, status: "removed" as const };
    });
  }
}

export const serverReviewsRepository = new ServerReviewsRepository();
