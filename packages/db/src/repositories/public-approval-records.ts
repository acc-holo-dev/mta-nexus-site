import { createHash } from "node:crypto";
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { AppError } from "@nexus/domain";
import type { db } from "../client";
import { verificationRequests } from "../schema";
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type PublicApprovalCursor = { createdAt: string; id: string; context: string };
export async function publicApprovalRecords(
  tx: Transaction,
  input: {
    targetId: string;
    types: ("user" | "developer" | "organization" | "server")[];
    contextParts: unknown[];
  },
  cursor?: PublicApprovalCursor,
) {
  const context = createHash("sha256").update(JSON.stringify(input.contextParts)).digest("hex");
  if (cursor && cursor.context !== context)
    throw new AppError("Approval page context changed", 400, "INVALID_CURSOR");
  const publicKey = sql<string>`md5(${verificationRequests.id})`;
  const rows = await tx
    .select({
      key: publicKey,
      type: verificationRequests.targetType,
      approvedAt: verificationRequests.resolvedAt,
      cursorTime: sql<string>`to_char(${verificationRequests.resolvedAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
    })
    .from(verificationRequests)
    .where(
      and(
        eq(verificationRequests.targetId, input.targetId),
        eq(verificationRequests.status, "approved"),
        isNotNull(verificationRequests.resolvedAt),
        inArray(verificationRequests.targetType, input.types),
        cursor
          ? sql`(${verificationRequests.resolvedAt}, ${publicKey}) < (${cursor.createdAt}::timestamptz, ${cursor.id})`
          : undefined,
      ),
    )
    .orderBy(desc(verificationRequests.resolvedAt), desc(publicKey))
    .limit(21);
  const items = rows.slice(0, 20),
    last = items.at(-1);
  return {
    items,
    context,
    hasMore: rows.length > 20,
    nextCursor: rows.length > 20 && last ? { createdAt: last.cursorTime, id: last.key } : null,
  };
}
