import { and, count, desc, eq, ilike, ne, or, sql } from "drizzle-orm";
import { AppError } from "@nexus/domain";
import type {
  AuditEvent,
  SupportCase,
  SupportCaseCategory,
  SupportCaseMessage,
  SupportCaseStatus,
  SupportMessageAuthorRole,
} from "@nexus/domain";
import { db } from "../client";
import {
  auditEvents,
  supportCaseMessages,
  supportCases,
  supportMutationRequests,
  users,
} from "../schema";
import { supportAccess, supportActor } from "./support-access";
import { supportRequesterNotice } from "./support-requester-notice";
import { containsPattern } from "./search-pattern";
const revision = sql`greatest(clock_timestamp(), date_trunc('milliseconds', ${supportCases.updatedAt}) + interval '1 millisecond')`;

export type SupportMutationKey = {
  actorId: string;
  requestKey: string;
  operation: "case" | "reply";
  fingerprint: string;
  caseId: string;
  messageId: string;
};

export type SupportMutationReplay =
  | { kind: "missing" }
  | { kind: "key_conflict" }
  | { kind: "replayed"; supportCase: SupportCase; message?: SupportCaseMessage };

class StaleSupportMutation extends Error {
  constructor() {
    super("Support status changed while preparing the message");
  }
}

export type SupportCaseMutationResult =
  | { kind: "created" | "replayed"; supportCase: SupportCase }
  | { kind: "key_conflict" };

export type SupportReplyMutationResult =
  | { kind: "created" | "replayed"; supportCase: SupportCase; message: SupportCaseMessage }
  | { kind: "key_conflict" }
  | { kind: "stale" };

export type StaffSupportFilters = {
  status?: SupportCaseStatus;
  category?: SupportCaseCategory;
  query?: string;
};
function supportFilters(filters: StaffSupportFilters) {
  const pattern = filters.query ? containsPattern(filters.query.slice(0, 120)) : undefined;
  return and(
    filters.status ? eq(supportCases.status, filters.status) : undefined,
    filters.category ? eq(supportCases.category, filters.category) : undefined,
    pattern ? or(ilike(supportCases.subject, pattern), ilike(supportCases.id, pattern)) : undefined,
  );
}

export type SupportPage<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

function normalizePage(page: number, total: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const requested = Number.isSafeInteger(page) && page > 0 ? page : 1;
  return {
    page: Math.min(requested, totalPages),
    totalPages,
  };
}

function normalizePageSize(pageSize: number, fallback: number, max: number) {
  return Number.isSafeInteger(pageSize) && pageSize > 0 ? Math.min(pageSize, max) : fallback;
}

export class SupportCaseRepository {
  async pageByRequester(
    requesterId: string,
    page = 1,
    pageSize = 25,
    filters: StaffSupportFilters = {},
  ): Promise<SupportPage<SupportCase>> {
    return db.transaction(
      async (tx) => {
        const boundedSize = normalizePageSize(pageSize, 25, 100);
        const [countRow] = await tx
          .select({ total: count() })
          .from(supportCases)
          .where(and(eq(supportCases.requesterId, requesterId), supportFilters(filters)));
        const total = countRow?.total ?? 0;
        const normalized = normalizePage(page, total, boundedSize);

        const items = (await tx
          .select()
          .from(supportCases)
          .where(and(eq(supportCases.requesterId, requesterId), supportFilters(filters)))
          .orderBy(desc(supportCases.updatedAt), desc(supportCases.id))
          .limit(boundedSize)
          .offset((normalized.page - 1) * boundedSize)) as unknown as SupportCase[];

        return {
          items,
          page: normalized.page,
          pageSize: boundedSize,
          total,
          totalPages: normalized.totalPages,
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

  async listByRequester(requesterId: string, limit = 100): Promise<SupportCase[]> {
    const page = await this.pageByRequester(requesterId, 1, limit);
    return page.items;
  }

  async pageStaff(
    page = 1,
    pageSize = 25,
    filters: StaffSupportFilters = {},
    actorId?: string,
  ): Promise<
    SupportPage<{
      supportCase: SupportCase;
      requesterUsername: string;
      requesterDisplayName: string;
    }>
  > {
    return db.transaction(
      async (tx) => {
        if (actorId && !(await supportActor(tx, actorId, false)).staff)
          throw new AppError("Staff required", 403, "FORBIDDEN");
        const boundedSize = normalizePageSize(pageSize, 25, 100);
        const where = supportFilters(filters);
        const [countRow] = await tx.select({ total: count() }).from(supportCases).where(where);
        const total = countRow?.total ?? 0;
        const normalized = normalizePage(page, total, boundedSize);

        const items = await tx
          .select({
            supportCase: supportCases,
            requesterUsername: users.username,
            requesterDisplayName: users.displayName,
          })
          .from(supportCases)
          .innerJoin(users, eq(users.id, supportCases.requesterId))
          .where(where)
          .orderBy(desc(supportCases.updatedAt), desc(supportCases.id))
          .limit(boundedSize)
          .offset((normalized.page - 1) * boundedSize);

        return {
          items: items as unknown as Array<{
            supportCase: SupportCase;
            requesterUsername: string;
            requesterDisplayName: string;
          }>,
          page: normalized.page,
          pageSize: boundedSize,
          total,
          totalPages: normalized.totalPages,
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

  async listStaff(limit = 100): Promise<
    Array<{
      supportCase: SupportCase;
      requesterUsername: string;
      requesterDisplayName: string;
    }>
  > {
    const page = await this.pageStaff(1, limit);
    return page.items;
  }

  async findById(id: string): Promise<SupportCase | null> {
    const [row] = await db.select().from(supportCases).where(eq(supportCases.id, id)).limit(1);
    return (row as unknown as SupportCase | undefined) ?? null;
  }

  async pageMessages(
    caseId: string,
    page = 1,
    pageSize = 100,
  ): Promise<SupportPage<SupportCaseMessage>> {
    return db.transaction(
      (tx) => this.pageMessagesWithin(tx, caseId, page, pageSize),
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

  async authorizedThread(caseId: string, actorId: string, page = 1) {
    return db.transaction(
      async (tx) => {
        const { actor, supportCase } = await supportAccess(tx, caseId, actorId, false);
        const messages = await this.pageMessagesWithin(tx, caseId, page, 100);
        return {
          supportCase,
          messages,
          staff: actor.staff,
          requester: supportCase.requesterId === actor.id,
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

  private async pageMessagesWithin(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    caseId: string,
    page: number,
    pageSize: number,
  ): Promise<SupportPage<SupportCaseMessage>> {
    const boundedSize = normalizePageSize(pageSize, 100, 100);
    const [countRow] = await tx
      .select({ total: count() })
      .from(supportCaseMessages)
      .where(eq(supportCaseMessages.caseId, caseId));
    const total = countRow?.total ?? 0;
    const normalized = normalizePage(page, total, boundedSize);

    const newestFirst = (await tx
      .select()
      .from(supportCaseMessages)
      .where(eq(supportCaseMessages.caseId, caseId))
      .orderBy(desc(supportCaseMessages.createdAt), desc(supportCaseMessages.id))
      .limit(boundedSize)
      .offset((normalized.page - 1) * boundedSize)) as unknown as SupportCaseMessage[];

    return {
      items: newestFirst.reverse(),
      page: normalized.page,
      pageSize: boundedSize,
      total,
      totalPages: normalized.totalPages,
    };
  }

  async listMessages(caseId: string): Promise<SupportCaseMessage[]> {
    const page = await this.pageMessages(caseId, 1, 100);
    return page.items;
  }

  async createWithInitialMessage(
    supportCase: Omit<SupportCase, "createdAt" | "updatedAt">,
    message: Omit<SupportCaseMessage, "createdAt">,
    audit: Omit<AuditEvent, "createdAt">,
  ): Promise<SupportCase> {
    return db.transaction(async (tx) => {
      const now = new Date();
      const [created] = await tx
        .insert(supportCases)
        .values({
          ...supportCase,
          relatedType: supportCase.relatedType ?? null,
          relatedId: supportCase.relatedId ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (!created) throw new Error("Support case insert did not return a row");

      await tx.insert(supportCaseMessages).values({
        ...message,
        authorId: message.authorId ?? null,
        createdAt: now,
      });
      await tx.insert(auditEvents).values({ ...audit, createdAt: now });

      return created as unknown as SupportCase;
    });
  }

  async addMessage(
    input: {
      id: string;
      caseId: string;
      authorId: string;
      authorRole: SupportMessageAuthorRole;
      body: string;
      expectedStatus: SupportCaseStatus;
    },
    audit: Omit<AuditEvent, "createdAt">,
  ): Promise<{
    supportCase: SupportCase;
    message: SupportCaseMessage;
  } | null> {
    return db.transaction(async (tx) => {
      if (audit.actorId !== input.authorId) throw new AppError("Invalid actor", 403, "FORBIDDEN");
      const { actor, supportCase } = await supportAccess(tx, input.caseId, input.authorId);
      const authorRole = supportCase.requesterId === actor.id ? "requester" : "staff";
      if (input.authorRole !== authorRole) throw new AppError("Invalid author", 403, "FORBIDDEN");
      const now = new Date();
      const [updated] = await tx
        .update(supportCases)
        .set({ status: "open", updatedAt: revision })
        .where(
          and(
            eq(supportCases.id, input.caseId),
            eq(supportCases.status, input.expectedStatus),
            ne(supportCases.status, "closed"),
          ),
        )
        .returning();

      if (!updated) return null;

      const [message] = await tx
        .insert(supportCaseMessages)
        .values({
          id: input.id,
          caseId: input.caseId,
          authorId: input.authorId,
          authorRole: input.authorRole,
          body: input.body,
          createdAt: now,
        })
        .returning();
      if (!message) throw new Error("Support message insert did not return a row");

      await tx.insert(auditEvents).values({
        ...audit,
        actorType: authorRole === "staff" ? "admin" : "user",
        details: { authorRole, from: supportCase.status, to: "open" },
        createdAt: now,
      });
      if (authorRole === "staff") await supportRequesterNotice(tx, updated, "reply", audit.id);

      return {
        supportCase: updated as unknown as SupportCase,
        message: message as unknown as SupportCaseMessage,
      };
    });
  }

  /**
   * Read-only replay lookup. A key is scoped to the authenticated actor,
   * never only to the shared support case.
   */
  async findMutationReplay(
    request: Pick<SupportMutationKey, "actorId" | "requestKey" | "operation" | "fingerprint">,
  ): Promise<SupportMutationReplay> {
    return db.transaction(
      async (tx) => {
        const [record] = await tx
          .select()
          .from(supportMutationRequests)
          .where(
            and(
              eq(supportMutationRequests.actorId, request.actorId),
              eq(supportMutationRequests.requestKey, request.requestKey),
            ),
          )
          .limit(1);

        if (!record) return { kind: "missing" };
        if (record.operation !== request.operation || record.fingerprint !== request.fingerprint) {
          return { kind: "key_conflict" };
        }

        const { supportCase } = await supportAccess(tx, record.caseId, request.actorId, false);

        if (record.operation === "case") {
          return { kind: "replayed", supportCase: supportCase as unknown as SupportCase };
        }
        const [message] = await tx
          .select()
          .from(supportCaseMessages)
          .where(
            and(
              eq(supportCaseMessages.id, record.messageId),
              eq(supportCaseMessages.caseId, record.caseId),
            ),
          )
          .limit(1);
        if (!message) throw new Error("Committed support idempotency record has no message");
        return {
          kind: "replayed",
          supportCase: supportCase as unknown as SupportCase,
          message: message as unknown as SupportCaseMessage,
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

  /** The key, case, initial message and audit commit atomically. */
  async createIdempotentCase(
    supportCase: Omit<SupportCase, "createdAt" | "updatedAt">,
    message: Omit<SupportCaseMessage, "createdAt">,
    audit: Omit<AuditEvent, "createdAt">,
    request: SupportMutationKey,
  ): Promise<SupportCaseMutationResult> {
    if (
      request.operation !== "case" ||
      request.actorId !== supportCase.requesterId ||
      audit.actorId !== request.actorId ||
      message.authorId !== request.actorId ||
      message.authorRole !== "requester" ||
      request.caseId !== supportCase.id ||
      request.messageId !== message.id ||
      message.caseId !== supportCase.id
    ) {
      throw new Error("Support creation idempotency scope mismatch");
    }

    const result = await db.transaction(async (tx) => {
      await supportActor(tx, request.actorId);
      const now = new Date();
      const [claimed] = await tx
        .insert(supportMutationRequests)
        .values({ ...request, createdAt: now })
        .onConflictDoNothing()
        .returning({ requestKey: supportMutationRequests.requestKey });
      if (!claimed) return { kind: "duplicate" as const };

      const [created] = await tx
        .insert(supportCases)
        .values({
          ...supportCase,
          relatedType: supportCase.relatedType ?? null,
          relatedId: supportCase.relatedId ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (!created) throw new Error("Support case insert did not return a row");

      await tx.insert(supportCaseMessages).values({
        ...message,
        authorId: message.authorId ?? null,
        createdAt: now,
      });
      await tx.insert(auditEvents).values({ ...audit, createdAt: now });
      return { kind: "created" as const, supportCase: created as unknown as SupportCase };
    });

    if (result.kind === "created") return result;
    const replay = await this.findMutationReplay(request);
    if (replay.kind === "missing")
      throw new Error("Missing idempotency reservation after conflict");
    if (replay.kind === "key_conflict") return replay;
    return { kind: "replayed", supportCase: replay.supportCase };
  }

  /**
   * Claim the request key before status compare-and-set. Concurrent retries
   * serialize on the unique key, and failed CAS rolls back the reservation.
   */
  async addIdempotentMessage(
    input: {
      id: string;
      caseId: string;
      authorId: string;
      authorRole: SupportMessageAuthorRole;
      body: string;
      expectedStatus: SupportCaseStatus;
      expectedUpdatedAt?: Date;
    },
    audit: Omit<AuditEvent, "createdAt">,
    request: SupportMutationKey,
  ): Promise<SupportReplyMutationResult> {
    if (
      request.operation !== "reply" ||
      request.actorId !== input.authorId ||
      audit.actorId !== input.authorId ||
      request.caseId !== input.caseId ||
      request.messageId !== input.id
    ) {
      throw new Error("Support reply idempotency scope mismatch");
    }

    let result:
      | { kind: "duplicate" }
      | { kind: "created"; supportCase: SupportCase; message: SupportCaseMessage };
    try {
      result = await db.transaction(async (tx) => {
        const { actor, supportCase } = await supportAccess(tx, input.caseId, input.authorId);
        const authorRole = supportCase.requesterId === actor.id ? "requester" : "staff";
        if (input.authorRole !== authorRole)
          throw new AppError("Invalid support author", 403, "FORBIDDEN");
        const now = new Date();
        const [claimed] = await tx
          .insert(supportMutationRequests)
          .values({ ...request, createdAt: now })
          .onConflictDoNothing()
          .returning({ requestKey: supportMutationRequests.requestKey });
        if (!claimed) return { kind: "duplicate" as const };
        if (
          supportCase.status === "closed" ||
          supportCase.status !== input.expectedStatus ||
          (input.expectedUpdatedAt &&
            supportCase.updatedAt.getTime() !== input.expectedUpdatedAt.getTime())
        )
          throw new StaleSupportMutation();

        const [updated] = await tx
          .update(supportCases)
          .set({ status: "open", updatedAt: revision })
          .where(
            and(
              eq(supportCases.id, input.caseId),
              eq(supportCases.status, input.expectedStatus),
              ne(supportCases.status, "closed"),
            ),
          )
          .returning();
        if (!updated) throw new StaleSupportMutation();

        const [message] = await tx
          .insert(supportCaseMessages)
          .values({
            id: input.id,
            caseId: input.caseId,
            authorId: input.authorId,
            authorRole: input.authorRole,
            body: input.body,
            createdAt: now,
          })
          .returning();
        if (!message) throw new Error("Support message insert did not return a row");

        await tx.insert(auditEvents).values({
          ...audit,
          actorType: authorRole === "staff" ? "admin" : "user",
          details: { authorRole, from: supportCase.status, to: "open" },
          createdAt: now,
        });
        if (authorRole === "staff") await supportRequesterNotice(tx, updated, "reply", audit.id);
        return {
          kind: "created" as const,
          supportCase: updated as unknown as SupportCase,
          message: message as unknown as SupportCaseMessage,
        };
      });
    } catch (error) {
      if (error instanceof StaleSupportMutation) return { kind: "stale" };
      throw error;
    }

    if (result.kind === "created") return result;
    const replay = await this.findMutationReplay(request);
    if (replay.kind === "missing")
      throw new Error("Missing idempotency reservation after conflict");
    if (replay.kind === "key_conflict") return replay;
    if (!replay.message) throw new Error("Support reply replay has no message");
    return {
      kind: "replayed",
      supportCase: replay.supportCase,
      message: replay.message,
    };
  }

  async updateStatus(
    id: string,
    status: SupportCaseStatus,
    audit: Omit<AuditEvent, "createdAt">,
    expectedStatus: SupportCaseStatus,
    expectedUpdatedAt?: Date,
  ): Promise<SupportCase | null> {
    return db.transaction(async (tx) => {
      const { actor, supportCase } = await supportAccess(tx, id, audit.actorId);
      if (
        !actor.staff &&
        (!expectedUpdatedAt || supportCase.status === "closed" || status === "closed")
      )
        throw new AppError("Staff required for closed cases", 403, "FORBIDDEN");
      if (
        supportCase.status !== expectedStatus ||
        (expectedUpdatedAt && supportCase.updatedAt.getTime() !== expectedUpdatedAt.getTime())
      )
        return null;
      if (supportCase.status === status) return supportCase as SupportCase;
      const now = new Date();
      const [updated] = await tx
        .update(supportCases)
        .set({ status, updatedAt: revision })
        .where(and(eq(supportCases.id, id), eq(supportCases.status, expectedStatus)))
        .returning();
      if (!updated) return null;

      await tx.insert(auditEvents).values({
        ...audit,
        actorType: actor.staff ? "admin" : "user",
        details: { from: supportCase.status, to: status },
        createdAt: now,
      });
      await supportRequesterNotice(tx, updated, status, audit.id);
      return updated as unknown as SupportCase;
    });
  }
}

export const supportCaseRepository = new SupportCaseRepository();
