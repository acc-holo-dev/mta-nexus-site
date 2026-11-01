import { db, users } from "@nexus/db";
import { hashPassword } from "@nexus/security";
import { eq } from "drizzle-orm";

/** Shared plaintext for integration tests that hit FLOW-22 staff_action routes. */
export const INTEGRATION_STAFF_PASSWORD = "Staff-password-123!";

export async function assignIntegrationStaffPassword(userId: string): Promise<string> {
  const passwordHash = await hashPassword(INTEGRATION_STAFF_PASSWORD);
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
  return passwordHash;
}
