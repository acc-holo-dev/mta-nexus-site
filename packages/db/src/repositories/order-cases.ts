import { createHash } from "node:crypto";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import {
  AppError,
  NotFoundError,
  orderCaseReviewTarget,
  type OrderCaseCreate,
  type OrderCaseEvidence,
  type OrderCaseReview,
  type OrderCaseReviewStatus,
  type OrderCaseView,
  type SupportCaseStatus,
} from "@nexus/domain";
import { db } from "../client";
import {
  auditEvents,
  commerceOrderCases as cases,
  orders,
  orderItems,
  payments,
  supportCases,
  supportCaseMessages,
  supportMutationRequests,
} from "../schema";
import type { ResourceTransaction } from "./entitlements";
import { historyPageBounds } from "./history-pagination";
import { supportActor } from "./support-access";
import { supportRequesterNotice } from "./support-requester-notice";

const orderProjection = {
  id: orders.id,
  orderNumber: orders.orderNumber,
  status: orders.status,
  totalAmount: orders.totalAmount,
  currency: orders.currency,
  createdAt: orders.createdAt,
};
const caseProjection = {
  id: cases.caseId,
  orderId: cases.orderId,
  kind: cases.kind,
  reviewStatus: cases.reviewStatus,
  revision: cases.revision,
  requestedAmount: cases.requestedAmount,
  currency: cases.currency,
  createdAt: cases.createdAt,
  subject: supportCases.subject,
  threadStatus: supportCases.status,
  supportUpdatedAt: supportCases.updatedAt,
};
const reviewActions = ["commerce.order_case.created", "commerce.order_case.reviewed"];
const conflict = (code: string) =>
  new AppError("Purchase case changed; reload its saved state", 409, code);

async function evidence(
  tx: ResourceTransaction,
  order: { id: string; orderNumber: string; status: string; totalAmount: number; currency: string },
): Promise<OrderCaseEvidence> {
  const [summary] = await tx
    .select({
      paymentCount: count(),
      recordedMatchingCaptureCount:
        sql<number>`count(*) filter (where ${payments.status} = 'completed' and ${payments.amount} = ${order.totalAmount} and ${payments.currency} = ${order.currency})`.mapWith(
          Number,
        ),
      recordedCaptureCount:
        sql<number>`count(*) filter (where ${payments.status} = 'completed')`.mapWith(Number),
      refundedRecordCount:
        sql<number>`count(*) filter (where ${payments.status} in ('refunded','partially_refunded'))`.mapWith(
          Number,
        ),
      disputedRecordCount:
        sql<number>`count(*) filter (where ${payments.status} = 'disputed')`.mapWith(Number),
    })
    .from(payments)
    .where(eq(payments.orderId, order.id));
  const [items] = await tx
    .select({ total: count() })
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));
  const rows = await tx
    .select({
      id: payments.id,
      status: payments.status,
      amount: payments.amount,
      currency: payments.currency,
      createdAt: payments.createdAt,
      updatedAt: payments.updatedAt,
    })
    .from(payments)
    .where(eq(payments.orderId, order.id))
    .orderBy(desc(payments.createdAt), desc(payments.id))
    .limit(20);
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    orderStatus: order.status,
    totalAmount: order.totalAmount,
    currency: order.currency,
    itemCount: items?.total ?? 0,
    paymentCount: summary?.paymentCount ?? 0,
    recordedCaptureCount: summary?.recordedCaptureCount ?? 0,
    recordedMatchingCaptureCount: summary?.recordedMatchingCaptureCount ?? 0,
    refundedRecordCount: summary?.refundedRecordCount ?? 0,
    disputedRecordCount: summary?.disputedRecordCount ?? 0,
    payments: rows.map((row) => ({
      recordKey: createHash("sha256").update(row.id).digest("hex"),
      status: row.status,
      amount: row.amount,
      currency: row.currency,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    capturedAt: new Date().toISOString(),
    confirmation: "recorded_only",
  };
}
function evidenceIdentity(value: OrderCaseEvidence) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        value.orderId,
        value.orderNumber,
        value.orderStatus,
        value.totalAmount,
        value.currency,
        value.itemCount,
        value.paymentCount,
        value.recordedCaptureCount,
        value.recordedMatchingCaptureCount,
        value.refundedRecordCount,
        value.disputedRecordCount,
        value.payments.map((p) => [
          p.recordKey,
          p.status,
          p.amount,
          p.currency,
          p.createdAt,
          p.updatedAt,
        ]),
      ]),
    )
    .digest("hex");
}

class OrderCasesRepository {
  async orderDetail(orderId: string, actorId: string) {
    return db.transaction(
      async (tx) => {
        await supportActor(tx, actorId, false);
        const [order] = await tx
          .select(orderProjection)
          .from(orders)
          .where(and(eq(orders.id, orderId), eq(orders.buyerId, actorId)))
          .limit(1);
        if (!order) throw new NotFoundError("Order", orderId);
        const [existing] = await tx
          .select(caseProjection)
          .from(cases)
          .innerJoin(supportCases, eq(cases.caseId, supportCases.id))
          .where(eq(cases.orderId, orderId))
          .limit(1);
        return {
          order,
          evidence: await evidence(tx, order),
          existingCase: (existing as OrderCaseView | undefined) ?? null,
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

  async create(input: {
    orderId: string;
    actorId: string;
    caseId: string;
    messageId: string;
    auditId: string;
    command: OrderCaseCreate;
  }) {
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify([
          "order-case",
          input.orderId,
          input.command.kind,
          input.command.subject,
          input.command.message,
          input.command.requestedAmount,
        ]),
      )
      .digest("hex");
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`order-case:${input.actorId}:${input.command.requestId}`}))`,
      );
      const [order] = await tx
        .select(orderProjection)
        .from(orders)
        .where(and(eq(orders.id, input.orderId), eq(orders.buyerId, input.actorId)))
        .limit(1)
        .for("no key update");
      if (!order) throw new NotFoundError("Order", input.orderId);
      await supportActor(tx, input.actorId);
      const [receipt] = await tx
        .select({
          fingerprint: supportMutationRequests.fingerprint,
          operation: supportMutationRequests.operation,
          caseId: supportMutationRequests.caseId,
        })
        .from(supportMutationRequests)
        .where(
          and(
            eq(supportMutationRequests.actorId, input.actorId),
            eq(supportMutationRequests.requestKey, input.command.requestId),
          ),
        )
        .limit(1);
      if (receipt && (receipt.operation !== "case" || receipt.fingerprint !== fingerprint))
        throw conflict("ORDER_CASE_REQUEST_CONFLICT");
      const [existing] = await tx
        .select({ id: cases.caseId })
        .from(cases)
        .where(eq(cases.orderId, order.id))
        .limit(1);
      if (receipt) {
        if (!existing || existing.id !== receipt.caseId)
          throw conflict("ORDER_CASE_REQUEST_CONFLICT");
        return {
          kind: "order_case_created" as const,
          orderId: order.id,
          caseId: receipt.caseId,
          requestId: input.command.requestId,
          replayed: true,
        };
      }
      if (existing) throw conflict("ORDER_CASE_EXISTS");
      if (
        input.command.requestedAmount !== null &&
        (input.command.requestedAmount > order.totalAmount ||
          !["USD", "EUR", "RUB"].includes(order.currency))
      )
        throw new AppError(
          "Requested amount must fit the recorded order currency and total",
          422,
          "ORDER_CASE_AMOUNT_INVALID",
        );
      if (input.command.kind === "refund_request" && order.status === "refunded")
        throw conflict("ORDER_REFUND_ALREADY_RECORDED");
      const snapshot = await evidence(tx, order),
        now = new Date();
      const [claimed] = await tx
        .insert(supportMutationRequests)
        .values({
          actorId: input.actorId,
          requestKey: input.command.requestId,
          operation: "case",
          fingerprint,
          caseId: input.caseId,
          messageId: input.messageId,
        })
        .onConflictDoNothing()
        .returning({ requestKey: supportMutationRequests.requestKey });
      if (!claimed) throw conflict("ORDER_CASE_REQUEST_CONFLICT");
      await tx.insert(supportCases).values({
        id: input.caseId,
        requesterId: input.actorId,
        category: "purchase",
        subject: input.command.subject,
        status: "open",
        relatedType: "purchase",
        relatedId: order.id,
        createdAt: now,
        updatedAt: now,
      });
      await tx.insert(cases).values({
        caseId: input.caseId,
        orderId: order.id,
        kind: input.command.kind,
        requestedAmount: input.command.requestedAmount,
        currency: order.currency,
        snapshot,
        createdAt: now,
      });
      await tx.insert(supportCaseMessages).values({
        id: input.messageId,
        caseId: input.caseId,
        authorId: input.actorId,
        authorRole: "requester",
        body: input.command.message,
      });
      await tx.insert(auditEvents).values({
        id: input.auditId,
        actorId: input.actorId,
        actorType: "user",
        targetType: "support_case",
        targetId: input.caseId,
        action: "commerce.order_case.created",
        details: { orderId: order.id, kind: input.command.kind, toReview: "intake" },
      });
      return {
        kind: "order_case_created" as const,
        orderId: order.id,
        caseId: input.caseId,
        requestId: input.command.requestId,
        replayed: false,
      };
    });
  }

  async page(
    actorId: string,
    staff: boolean,
    page = 1,
    filter: { reviewStatus?: OrderCaseReviewStatus; threadStatus?: SupportCaseStatus } = {},
  ) {
    return db.transaction(
      async (tx) => {
        const actor = await supportActor(tx, actorId, false);
        if (staff && !actor.staff) throw new AppError("Staff required", 403, "FORBIDDEN");
        const where = and(
          staff ? undefined : eq(orders.buyerId, actorId),
          filter.reviewStatus ? eq(cases.reviewStatus, filter.reviewStatus) : undefined,
          filter.threadStatus ? eq(supportCases.status, filter.threadStatus) : undefined,
        );
        const [summary] = await tx
          .select({ total: count() })
          .from(cases)
          .innerJoin(orders, eq(cases.orderId, orders.id))
          .innerJoin(supportCases, eq(cases.caseId, supportCases.id))
          .where(where);
        const bounds = historyPageBounds(summary?.total ?? 0, page);
        const rows = await tx
          .select({ ...caseProjection, orderNumber: orders.orderNumber })
          .from(cases)
          .innerJoin(orders, eq(cases.orderId, orders.id))
          .innerJoin(supportCases, eq(cases.caseId, supportCases.id))
          .where(where)
          .orderBy(
            staff ? sql`${cases.createdAt} asc` : desc(cases.createdAt),
            staff ? sql`${cases.caseId} asc` : desc(cases.caseId),
          )
          .limit(bounds.pageSize)
          .offset(bounds.offset);
        return { items: rows as (OrderCaseView & { orderNumber: string })[], ...bounds };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

  async detail(caseId: string, actorId: string, staff = false, page = 1) {
    return db.transaction(
      async (tx) => {
        const actor = await supportActor(tx, actorId, false);
        if (staff && !actor.staff) throw new AppError("Staff required", 403, "FORBIDDEN");
        const [row] = await tx
          .select({
            case: caseProjection,
            order: orderProjection,
            snapshot: cases.snapshot,
            buyerId: orders.buyerId,
          })
          .from(cases)
          .innerJoin(orders, eq(cases.orderId, orders.id))
          .innerJoin(supportCases, eq(cases.caseId, supportCases.id))
          .where(and(eq(cases.caseId, caseId), staff ? undefined : eq(orders.buyerId, actorId)))
          .limit(1);
        if (!row) throw new NotFoundError("Purchase case", caseId);
        const scope = and(
          eq(auditEvents.targetType, "support_case"),
          eq(auditEvents.targetId, caseId),
          inArray(auditEvents.action, reviewActions),
        );
        const [summary] = await tx.select({ total: count() }).from(auditEvents).where(scope);
        const bounds = historyPageBounds(summary?.total ?? 0, page);
        const history = await tx
          .select({
            id: auditEvents.id,
            action: auditEvents.action,
            reviewStatus: sql<OrderCaseReviewStatus>`${auditEvents.details}->>'toReview'`,
            notes: sql<string | null>`${auditEvents.details}->>'notes'`,
            createdAt: auditEvents.createdAt,
          })
          .from(auditEvents)
          .where(scope)
          .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
          .limit(bounds.pageSize)
          .offset(bounds.offset);
        const current = await evidence(tx, row.order);
        return {
          case: row.case as OrderCaseView,
          order: row.order,
          snapshot: row.snapshot,
          current,
          evidenceChanged: evidenceIdentity(row.snapshot) !== evidenceIdentity(current),
          evidenceHash: evidenceIdentity(current),
          history,
          ...bounds,
          canReview: staff && actor.staff && actor.id !== row.buyerId,
          canRecommendRefund: staff && actor.role === "admin" && actor.id !== row.buyerId,
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

  async review(input: {
    caseId: string;
    actorId: string;
    command: OrderCaseReview;
    auditId: string;
    statusAuditId: string;
    messageId: string;
  }) {
    return db.transaction(async (tx) => {
      const [target] = await tx
        .select({ orderId: cases.orderId })
        .from(cases)
        .where(eq(cases.caseId, input.caseId))
        .limit(1);
      if (!target) throw new NotFoundError("Purchase case", input.caseId);
      const [order] = await tx
        .select({ ...orderProjection, buyerId: orders.buyerId })
        .from(orders)
        .where(eq(orders.id, target.orderId))
        .limit(1)
        .for("no key update");
      if (!order) throw new NotFoundError("Purchase case", input.caseId);
      const actor = await supportActor(tx, input.actorId);
      if (!actor.staff || actor.id === order.buyerId)
        throw new AppError("Independent staff review required", 403, "FORBIDDEN");
      const [ticket] = await tx
        .select({
          status: supportCases.status,
          updatedAt: supportCases.updatedAt,
          requesterId: supportCases.requesterId,
        })
        .from(supportCases)
        .where(eq(supportCases.id, input.caseId))
        .limit(1)
        .for("update");
      const [current] = await tx
        .select({
          kind: cases.kind,
          reviewStatus: cases.reviewStatus,
          revision: cases.revision,
          requestedAmount: cases.requestedAmount,
          currency: cases.currency,
        })
        .from(cases)
        .where(eq(cases.caseId, input.caseId))
        .limit(1)
        .for("update");
      if (!ticket || !current) throw new NotFoundError("Purchase case", input.caseId);
      if (
        current.revision !== input.command.expectedRevision ||
        ticket.updatedAt.toISOString() !== input.command.expectedSupportUpdatedAt
      )
        throw conflict("ORDER_CASE_REVISION_CONFLICT");
      const currentEvidence = await evidence(tx, order);
      if (evidenceIdentity(currentEvidence) !== input.command.expectedEvidenceHash)
        throw conflict("ORDER_CASE_EVIDENCE_CHANGED");
      const action = input.command.action;
      if (
        (action === "reopen" && ticket.status === "open") ||
        (action !== "reopen" && ticket.status !== "open")
      )
        throw conflict("ORDER_CASE_THREAD_CHANGED");
      if (action !== "start_review" && action !== "reopen" && current.reviewStatus !== "reviewing")
        throw conflict("ORDER_CASE_REVIEW_REQUIRED");
      if (action === "recommend_refund" || action === "decline_refund") {
        if (actor.role !== "admin")
          throw new AppError("Administrator review required", 403, "FORBIDDEN");
        if (
          !["refund_request", "dispute"].includes(current.kind) ||
          current.requestedAmount === null
        )
          throw conflict("ORDER_CASE_REFUND_NOT_REQUESTED");
        if (action === "recommend_refund" && order.status === "refunded")
          throw conflict("ORDER_REFUND_ALREADY_RECORDED");
        if (
          action === "recommend_refund" &&
          (order.status !== "completed" ||
            order.currency !== current.currency ||
            current.requestedAmount > order.totalAmount ||
            currentEvidence.recordedCaptureCount !== 1 ||
            currentEvidence.recordedMatchingCaptureCount !== 1 ||
            currentEvidence.refundedRecordCount > 0 ||
            currentEvidence.disputedRecordCount > 0)
        )
          throw conflict("ORDER_CASE_RECONCILIATION_REQUIRED");
      }
      const reviewStatus = orderCaseReviewTarget(action);
      const [updated] = await tx
        .update(cases)
        .set({ reviewStatus })
        .where(and(eq(cases.caseId, input.caseId), eq(cases.revision, current.revision)))
        .returning({ revision: cases.revision });
      if (!updated) throw conflict("ORDER_CASE_REVISION_CONFLICT");
      const status: SupportCaseStatus = ["decline_refund", "resolve", "dismiss"].includes(action)
        ? "resolved"
        : "open";
      const [updatedTicket] = await tx
        .update(supportCases)
        .set({
          status,
          updatedAt: sql`greatest(clock_timestamp(), date_trunc('milliseconds', ${supportCases.updatedAt}) + interval '1 millisecond')`,
        })
        .where(eq(supportCases.id, input.caseId))
        .returning({
          id: supportCases.id,
          requesterId: supportCases.requesterId,
          updatedAt: supportCases.updatedAt,
        });
      if (!updatedTicket) throw conflict("ORDER_CASE_REVISION_CONFLICT");
      await tx.insert(supportCaseMessages).values({
        id: input.messageId,
        caseId: input.caseId,
        authorId: actor.id,
        authorRole: "staff",
        body: input.command.notes,
      });
      await tx.insert(auditEvents).values({
        id: input.auditId,
        actorId: actor.id,
        actorType: "admin",
        action: "commerce.order_case.reviewed",
        targetId: input.caseId,
        targetType: "support_case",
        details: {
          orderId: order.id,
          action,
          fromReview: current.reviewStatus,
          toReview: reviewStatus,
          notes: input.command.notes,
          revision: updated.revision,
          evidence: currentEvidence,
          evidenceHash: input.command.expectedEvidenceHash,
          financialExecution: false,
        },
      });
      if (ticket.status !== status)
        await tx.insert(auditEvents).values({
          id: input.statusAuditId,
          actorId: actor.id,
          actorType: "admin",
          action: "support.case.status_changed",
          targetType: "support_case",
          targetId: input.caseId,
          details: { from: ticket.status, to: status },
        });
      await supportRequesterNotice(
        tx,
        updatedTicket,
        ticket.status === status ? "reply" : status,
        input.auditId,
      );
      return {
        kind: "order_case_reviewed" as const,
        caseId: input.caseId,
        action,
        reviewStatus,
        revision: updated.revision,
        threadStatus: status,
        supportUpdatedAt: updatedTicket.updatedAt,
        financialExecution: false as const,
      };
    });
  }
}
export const orderCasesRepository = new OrderCasesRepository();
