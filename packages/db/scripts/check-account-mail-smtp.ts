import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, auditEvents, users } from "../src/client";
import { accountMailOutbox } from "../src/account-mail-schema";
import { AccountMailCipher } from "../src/repositories/account-mail-crypto";
import { accountMailOutboxRepository } from "../src/repositories/account-mail-outbox";
import { AccountMailDispatcher } from "../src/repositories/account-mail-dispatcher";
import { AccountMailSmtpTransport } from "../src/repositories/account-mail-smtp";
import { authService } from "../../../apps/web/src/lib/services/auth-service";
import { userRepository } from "../src/repositories/users";
import { generateId } from "../../security/src/index";

const port = Number(process.env.SMTP_TEST_PORT || 2465);
const caFile = process.env.SMTP_TEST_CA_FILE;
if (!caFile) throw new Error("SMTP_TEST_CA_FILE is required");
const ca = readFileSync(caFile);
const common = { host: "127.0.0.1", port, servername: "localhost", from: "no-reply@nexus-mta.test", ca };

const send = async (recipient: string, timeoutMs = 1000, trust: string | Buffer | undefined = ca) =>
  new AccountMailSmtpTransport({ ...common, ca: trust, timeoutMs }).send({
    recipient,
    subject: "Synthetic D2c transport check",
    text: "No production delivery.",
    sendBefore: new Date(Date.now() + 5_000),
    messageId: `ame_${recipient.replace(/[^A-Za-z0-9_-]/g, "_")}`,
  });

const accepted = await send("accept@example.invalid");
assert.equal(accepted.outcome, "accepted");
assert.equal(accepted.uncertain, false);

const authenticated = await new AccountMailSmtpTransport({
  ...common,
  username: "nexus-ci-user",
  password: "nexus-ci-password",
  timeoutMs: 1000,
}).send({
  recipient: "auth@example.invalid",
  subject: "Synthetic D5 authenticated transport check",
  text: "No production delivery.",
  sendBefore: new Date(Date.now() + 5_000),
  messageId: "ame_authenticated_transport",
});
assert.equal(authenticated.outcome, "accepted");
assert.equal(authenticated.uncertain, false);

const authRejected = await new AccountMailSmtpTransport({
  ...common,
  username: "nexus-ci-user",
  password: "wrong-ci-password",
  timeoutMs: 1000,
}).send({
  recipient: "auth-rejected@example.invalid",
  subject: "Synthetic D5 rejected authentication check",
  text: "No production delivery.",
  sendBefore: new Date(Date.now() + 5_000),
  messageId: "ame_rejected_auth_transport",
});
assert.equal(authRejected.outcome, "retry");
assert.equal(authRejected.uncertain, false);
assert.equal(authRejected.code, 535);

const temporary = await send("retry4xx@example.invalid");
assert.equal(temporary.outcome, "retry");
assert.equal(temporary.uncertain, false);
assert.equal(temporary.code, 451);

const rejected = await send("reject5xx@example.invalid");
assert.equal(rejected.outcome, "discard");
assert.equal(rejected.uncertain, false);
assert.equal(rejected.code, 550);

const uncertain = await send("uncertain@example.invalid");
assert.equal(uncertain.outcome, "retry");
assert.equal(uncertain.uncertain, true);

const timedOut = await send("slow@example.invalid", 250);
assert.equal(timedOut.outcome, "retry");
assert.equal(timedOut.uncertain, true);

const untrusted = await new AccountMailSmtpTransport({
  host: "127.0.0.1", port, servername: "localhost",
  from: "no-reply@nexus-mta.test", timeoutMs: 1000,
}).send({
  recipient: "accept@example.invalid", subject: "Synthetic D2c untrusted certificate check",
  text: "No production delivery.", sendBefore: new Date(Date.now() + 5_000),
  messageId: "ame_untrusted_transport",
});
assert.equal(untrusted.outcome, "retry");
assert.equal(untrusted.uncertain, false);

const username = `d2c_${generateId("usr").slice(-18)}`;
const password = "Synthetic-D2c-password!";
const email = `${username}@example.invalid`;
let userId = "";
try {
  const registered = await authService.register({ username, email, password });
  userId = registered.user.id;
  const stored = await userRepository.findByEmail(email);
  assert.ok(stored?.passwordHash);
  const cipher = new AccountMailCipher("d2c", { d2c: randomBytes(32) });
  const queued = await accountMailOutboxRepository.enqueue({
    purpose: "email_verify", userId, currentToken: registered.token,
    expectedPasswordHash: stored.passwordHash, auditId: generateId("aud"),
  }, cipher);
  const dispatcher = new AccountMailDispatcher({
    cipher,
    transport: new AccountMailSmtpTransport({ ...common, timeoutMs: 1000 }),
    appUrl: "https://nexus-mta.test",
  });
  const summary = await dispatcher.runBatch(10);
  assert.equal(summary.accepted, 1);
  assert.equal((await db.select().from(accountMailOutbox).where(eq(accountMailOutbox.id, queued.id))).length, 0);
  const audits = await db.select().from(auditEvents).where(and(
    eq(auditEvents.action, "auth.mail_transport_accepted"),
    eq(auditEvents.targetId, queued.id),
  ));
  assert.equal(audits.length, 1);
} finally {
  if (userId) await db.delete(users).where(eq(users.id, userId));
}

process.stdout.write("PASS: isolated TLS SMTP acceptance, AUTH, refusal, timeout, uncertainty, trust and DB dispatcher\n");
