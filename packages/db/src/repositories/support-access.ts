import { eq } from "drizzle-orm";
import { AppError } from "@nexus/domain";
import type { db } from "../client";
import { supportCases, users } from "../schema";
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function supportActor(tx: Transaction, actorId: string | null, lock = true) {
  if (!actorId) throw new AppError("Authentication required", 401, "UNAUTHORIZED");
  const query = tx
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, actorId));
  const [actor] = await (lock ? query.for("share") : query).limit(1);
  if (!actor) throw new AppError("Authentication required", 401, "UNAUTHORIZED");
  return { ...actor, staff: ["admin", "moderator"].includes(actor.role) };
}
export async function supportAccess(
  tx: Transaction,
  id: string,
  actorId: string | null,
  lock = true,
) {
  const actor = await supportActor(tx, actorId, lock);
  const query = tx.select().from(supportCases).where(eq(supportCases.id, id));
  const [supportCase] = await (lock ? query.for("update") : query).limit(1);
  if (!supportCase || (!actor.staff && supportCase.requesterId !== actor.id))
    throw new AppError("Support case not found", 404, "NOT_FOUND");
  return { actor, supportCase };
}
