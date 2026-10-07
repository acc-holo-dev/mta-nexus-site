import { and, asc, desc, eq, ne } from "drizzle-orm";
import type {
  AuditEvent,
  SupportCase,
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

export class SupportCaseRepository {
  async listByRequester(
    requesterId: string,
    limit = 100,
  ): Promise<SupportCase[]> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      throw new RangeError("Invalid support case limit");
    }

    return (await db
      .select()
      .from(supportCases)
      .where(eq(supportCases.requesterId, requesterId))
      .orderBy(desc(supportCases.updatedAt), desc(supportCases.id))
      .limit(limit)) as unknown as SupportCase[];
  }

  async listStaff(limit = 100): Promise<
    Array<{
      supportCase: SupportCase;
      requesterUsername: string;
      requesterDisplayName: string;
    }>
  > {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      throw new RangeError("Invalid support case limit");
    }

    const rows = await db
      .select({
        supportCase: supportCases,
        requesterUsername: users.username,
        requesterDisplayName: users.displayName,
      })
      .from(supportCases)
      .innerJoin(users, eq(users.id, supportCases.requesterId))
      .orderBy(desc(supportCases.updatedAt), desc(supportCases.id))
      .limit(limit);

    return rows as unknown as Array<{
      supportCase: SupportCase;
      requesterUsername: string;
      requesterDisplayName: string;
    }>;
  }

  async findById(id: string): Promise<SupportCase | null> {
    const [row] = await db
      .select()
      .from(supportCases)
      .where(eq(supportCases.id, id))
      .limit(1);
    return (row as unknown as SupportCase | undefined) ?? null;
  }

  async listMessages(caseId: string): Promise<SupportCaseMessage[]> {
    return (await db
      .select()
      .from(supportCaseMessages)
      .where(eq(supportCaseMessages.caseId, caseId))
      .orderBy(
        asc(supportCaseMessages.createdAt),
        asc(supportCaseMessages.id),
      )) as unknown as SupportCaseMessage[];
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
  ): Promise<SupportCase | null> {
    return db.transaction(async (tx) => {
      const now = new Date();
      const [updated] = await tx
        .update(supportCases)
        .set({ status, updatedAt: now })
        .where(eq(supportCases.id, id))
        .returning();
      if (!updated) return null;

      await tx.insert(auditEvents).values({ ...audit, createdAt: now });
      return updated as unknown as SupportCase;
    });
  }
}

export const supportCaseRepository = new SupportCaseRepository();
