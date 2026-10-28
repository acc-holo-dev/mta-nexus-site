import { and, eq } from "drizzle-orm";
import { closeDatabaseConnection, db } from "../src/client";
import { accountMailOutbox } from "../src/account-mail-schema";
import { authChallenges } from "../src/account-recovery-schema";
import { auditEvents } from "../src/schema";

if (
  process.env.GITHUB_ACTIONS !== "true" ||
  process.env.RUNNER_ENVIRONMENT !== "github-hosted" ||
  process.env.NEXUS_D5_MAIL_CHECK !== "true"
) {
  throw new Error("Refusing account mail delivery check outside disposable CI");
}
const challengeId = process.argv[2] ?? "";
const mailId = process.argv[3] ?? "";
if (!/^ach_[A-Za-z0-9_-]+$/.test(challengeId) || !/^ame_[A-Za-z0-9_-]+$/.test(mailId)) {
  throw new Error("Synthetic CI identifiers required");
}

try {
  const [mail] = await db
    .select({ id: accountMailOutbox.id })
    .from(accountMailOutbox)
    .where(eq(accountMailOutbox.id, mailId))
    .limit(1);
  if (mail) process.exitCode = 2;
  else {
    const [proof] = await db
      .select({
        consumedAt: authChallenges.consumedAt,
        revokedAt: authChallenges.revokedAt,
      })
      .from(authChallenges)
      .where(eq(authChallenges.id, challengeId))
      .limit(1);
    const accepted = await db
      .select({ id: auditEvents.id })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.targetId, mailId),
          eq(auditEvents.action, "auth.mail_transport_accepted"),
        ),
      )
      .limit(1);
    if (!proof || proof.consumedAt || proof.revokedAt || accepted.length !== 1)
      process.exitCode = 3;
    else process.stdout.write("PASS\n");
  }
} finally {
  await closeDatabaseConnection();
}
