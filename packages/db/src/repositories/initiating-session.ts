import { and, eq, gt } from "drizzle-orm";
import { UnauthorizedError } from "@nexus/domain";
import { sessions } from "../schema";
import type { ResourceTransaction } from "../transaction";
import { digestSessionToken } from "./sessions";

// Caller locks the actor first. This locks the initiating session before a write.
export async function lockInitiatingSession(
  tx: ResourceTransaction,
  actorId: string,
  token: string,
) {
  const [current] = await tx
    .select({ id: sessions.id, expiresAt: sessions.expiresAt })
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, actorId),
        eq(sessions.token, digestSessionToken(token)),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .for("update");
  const expiresAt = current ? new Date(current.expiresAt).getTime() : Number.NaN;
  if (!current || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    throw new UnauthorizedError("Authentication required");
  }
}
