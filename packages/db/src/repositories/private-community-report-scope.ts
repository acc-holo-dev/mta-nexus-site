import { ForbiddenError } from "@nexus/domain";
import { eq, sql } from "drizzle-orm";
import type { db } from "../client";
import { comments, content, reports, users } from "../schema";

type Session = Pick<typeof db, "select" | "insert" | "update" | "delete" | "execute">;

export const editorialId = sql<
  string | null
>`case when ${content.type} in ('article','news','devlog','update','announcement','post','question','review') and ${content.status} in ('draft','published','archived') then ${content.id} else null end`;
// Existing commercial reviews share comments. They are never actionable here.
export const communityTarget = sql`(${reports.targetType} = 'content' or (${reports.targetType} = 'comment' and
  (exists (select 1 from ${comments} where ${comments.id} = ${reports.targetId} and ${comments.contentId} is not null and ${comments.productId} is null)
  or not exists (select 1 from ${comments} where ${comments.id} = ${reports.targetId}))))`;

export async function requireStaff(tx: Session, actorId: string, lock = true) {
  const query = tx.select({ role: users.role }).from(users).where(eq(users.id, actorId));
  const [actor] = await (lock ? query.for("share") : query).limit(1);
  if (!actor || !["admin", "moderator"].includes(actor.role)) throw new ForbiddenError();
}
