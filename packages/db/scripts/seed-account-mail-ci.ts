import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { closeDatabaseConnection, db } from "../src/client";
import { accountMailOutbox } from "../src/account-mail-schema";
import { authService } from "../../../apps/web/src/lib/services/auth-service";

if (process.env.GITHUB_ACTIONS !== "true"
  || process.env.RUNNER_ENVIRONMENT !== "github-hosted"
  || process.env.NEXUS_D5_MAIL_SEED !== "true") {
  throw new Error("Refusing account mail seed outside disposable CI");
}
const password = process.env.NEXUS_D5_TEST_PASSWORD;
if (!password || password.length < 16) throw new Error("Synthetic CI password required");

try {
  const nonce = randomUUID().replaceAll("-", "").slice(0, 16);
  const email = `d5-${nonce}@example.invalid`;
  const username = `d5_${nonce}`;
  const registered = await authService.register({ email, username, password });
  const queued = await authService.requestRecoveryEmailVerification({
    userId: registered.user.id,
    currentToken: registered.token,
    currentPassword: password,
  });
  if (!queued.accepted || !queued.challengeId) throw new Error("Synthetic mail was not queued");
  const [mail] = await db.select({ id: accountMailOutbox.id }).from(accountMailOutbox)
    .where(eq(accountMailOutbox.challengeId, queued.challengeId)).limit(1);
  if (!mail) throw new Error("Synthetic outbox row missing");
  process.stdout.write(JSON.stringify({ challengeId: queued.challengeId, mailId: mail.id }));
} finally {
  await closeDatabaseConnection();
}
