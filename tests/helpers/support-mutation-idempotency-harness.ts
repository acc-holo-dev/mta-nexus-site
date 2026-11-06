import { randomUUID as sessionUUID } from "node:crypto";
import { sessionRepository as supportSessions } from "@nexus/db";

/** Create a short-lived initiating session token for a support mutation. */
export async function initiatingToken(userId: string) {
  const token = sessionUUID();
  await supportSessions.create({
    id: `ses_${sessionUUID()}`,
    userId,
    token,
    expiresAt: new Date(Date.now() + 3_600_000),
  });
  return token;
}
