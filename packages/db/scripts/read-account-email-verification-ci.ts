import { eq, desc } from "drizzle-orm";
import { db, closeDatabaseConnection } from "../src/client";
import { users } from "../src/schema";
import { authChallenges } from "../src/account-recovery-schema";
import { accountMailOutbox } from "../src/account-mail-schema";
import { createAccountMailProducerCipher } from "../src/repositories/account-mail-runtime";

if (process.env.GITHUB_ACTIONS !== "true"
  || process.env.RUNNER_ENVIRONMENT !== "github-hosted"
  || process.env.NEXUS_ACCOUNT_MAIL_TEST_READ !== "true") {
  throw new Error("Refusing account mail test read outside disposable CI");
}
const email = process.argv[2]?.toLowerCase();
if (!email || !email.endsWith("@example.invalid")) {
  throw new Error("Synthetic CI recipient required");
}

try {
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (!user) throw new Error("Synthetic CI recipient not found");
  const [challenge] = await db.select({
    id: authChallenges.id,
    expiresAt: authChallenges.expiresAt,
  }).from(authChallenges)
    .where(eq(authChallenges.userId, user.id))
    .orderBy(desc(authChallenges.createdAt))
    .limit(1);
  if (!challenge) throw new Error("Synthetic CI challenge not found");
  const [mail] = await db.select().from(accountMailOutbox)
    .where(eq(accountMailOutbox.challengeId, challenge.id)).limit(1);
  if (!mail) throw new Error("Synthetic CI mail not found");
  const payload = createAccountMailProducerCipher().open({
    id: mail.id,
    challengeId: mail.challengeId,
    userId: user.id,
    purpose: "email_verify",
    expiresAt: mail.expiresAt,
  }, mail.payload);
  if (payload.recipient !== email) throw new Error("Synthetic CI recipient mismatch");
  process.stdout.write(JSON.stringify({ challengeId: challenge.id, token: payload.token }));
} finally {
  await closeDatabaseConnection();
}
