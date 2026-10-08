import { and, count, desc, eq, ne } from "drizzle-orm";
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
  users,
} from "../schema";

export type StaffSupportFilters = {
  status?: SupportCaseStatus;
  category?: SupportCaseCategory;
};

export type SupportPage<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

function normalizePage(page: number, total: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const requested =
    Number.isSafeInteger(page) && page > 0 ? page : 1;
  return {
    page: Math.min(requested, totalPages),
    totalPages,
  };
}

function normalizePageSize(pageSize: number, fallback: number, max: number) {
  return Number.isSafeInteger(pageSize) && pageSize > 0
    ? Math.min(pageSize, max)
    : fallback;
}

export class SupportCaseRepository {
  async pageByRequester(
    requesterId: string,
    page = 1,
    pageSize = 25,
  ): Promise<SupportPage<SupportCase>> {
    const boundedSize = normalizePageSize(pageSize, 25, 100);
    const [countRow] = await db
      .select({ total: count() })
      .from(supportCases)
      .where(eq(supportCases.requesterId, requesterId));
    const total = countRow?.total ?? 0;
    const normalized = normalizePage(page, total, boundedSize);

    const items = (await db
      .select()
      .from(supportCases)
      .where(eq(supportCases.requesterId, requesterId))
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
  }

  async listByRequester(
    requesterId: string,
    limit = 100,
  ): Promise<SupportCase[]> {
    const page = await this.pageByRequester(requesterId, 1, limit);
    return page.items;
  }

  async pageStaff(
    page = 1,
    pageSize = 25,
    filters: StaffSupportFilters = {},
  ): Promise<
    SupportPage<{
      supportCase: SupportCase;
      requesterUsername: string;
      requesterDisplayName: string;
    }>
  > {
    const boundedSize = normalizePageSize(pageSize, 25, 100);
    const where = and(
      filters.status ? eq(supportCases.status, filters.status) : undefined,
      filters.category ? eq(supportCases.category, filters.category) : undefined,
    );
    const [countRow] = await db
      .select({ total: count() })
      .from(supportCases)
      .where(where);
    const total = countRow?.total ?? 0;
    const normalized = normalizePage(page, total, boundedSize);

    const items = await db
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
    const [row] = await db
      .select()
      .from(supportCases)
      .where(eq(supportCases.id, id))
      .limit(1);
    return (row as unknown as SupportCase | undefined) ?? null;
  }

  async pageMessages(
    caseId: string,
    page = 1,
    pageSize = 100,
  ): Promise<SupportPage<SupportCaseMessage>> {
    const boundedSize = normalizePageSize(pageSize, 100, 100);
    const [countRow] = await db
      .select({ total: count() })
      .from(supportCaseMessages)
      .where(eq(supportCaseMessages.caseId, caseId));
    const total = countRow?.total ?? 0;
    const normalized = normalizePage(page, total, boundedSize);

    const newestFirst = (await db
      .select()
      .from(supportCaseMessages)
      .where(eq(supportCaseMessages.caseId, caseId))
      .orderBy(
        desc(supportCaseMessages.createdAt),
        desc(supportCaseMessages.id),
      )
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
      const now = new Date();
      const [updated] = await tx
        .update(supportCases)
        .set({ status: "open", updatedAt: now })
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

      await tx.insert(auditEvents).values({ ...audit, createdAt: now });

      return {
        supportCase: updated as unknown as SupportCase,
        message: message as unknown as SupportCaseMessage,
      };
    });
  }

  async updateStatus(
    id: string,
    status: SupportCaseStatus,
    audit: Omit<AuditEvent, "createdAt">,
    expectedStatus: SupportCaseStatus,
  ): Promise<SupportCase | null> {
    return db.transaction(async (tx) => {
      const now = new Date();
      const [updated] = await tx
        .update(supportCases)
        .set({ status, updatedAt: now })
        .where(
          and(
            eq(supportCases.id, id),
            eq(supportCases.status, expectedStatus),
          ),
        )
        .returning();
      if (!updated) return null;

      await tx.insert(auditEvents).values({ ...audit, createdAt: now });
      return updated as unknown as SupportCase;
    });
  }
}

export const supportCaseRepository = new SupportCaseRepository();
