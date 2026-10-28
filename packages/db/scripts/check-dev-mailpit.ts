import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { readAccountMailRuntimeConfig } from "../src/repositories/account-mail-runtime";
import { AccountMailSmtpTransport } from "../src/repositories/account-mail-smtp";

// Run inside the optional development mail-worker. Never probe an external provider.
if (process.env.NODE_ENV !== "development") throw new Error("Mailpit check is development-only");
const config = readAccountMailRuntimeConfig(process.env);
if (
  config.smtpHost !== "mailpit" ||
  config.smtpServername !== "mailpit" ||
  config.smtpMode !== "implicit_tls" ||
  config.smtpPort !== 1025 ||
  !config.smtpCa
) {
  throw new Error("Mailpit check requires the local TLS capture configuration");
}

const transport = new AccountMailSmtpTransport({
  host: config.smtpHost,
  port: config.smtpPort,
  servername: config.smtpServername,
  from: config.smtpFrom,
  ca: config.smtpCa,
  timeoutMs: config.smtpTimeoutMs,
});
const id = randomUUID();
const subject = `NEXUS development mail check ${id}`;
const text = `Synthetic local mail capture probe ${id}. No recovery token or user data.`;
const result = await transport.send({
  recipient: "smoke@example.invalid",
  subject,
  text,
  messageId: `ame_dev_${id}`,
  sendBefore: new Date(Date.now() + 30_000),
});
if (result.outcome !== "accepted") throw new Error(`Local SMTP probe failed at ${result.stage}`);

async function api(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(`http://mailpit:8025/api/v1/${path}`, {
    ...init,
    redirect: "error",
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Mailpit API returned ${response.status}`);
  return response;
}

const deadline = Date.now() + 15_000;
let capturedId: string | undefined;
do {
  const list: { messages?: { ID: string; Subject: string }[] } = await (
    await api("messages?limit=200")
  ).json();
  capturedId = list.messages?.find((message) => message.Subject === subject)?.ID;
  if (capturedId) break;
  await sleep(250);
} while (Date.now() < deadline);
if (!capturedId) throw new Error("Mailpit did not capture the accepted SMTP probe");

try {
  const message: { Text?: string } = await (
    await api(`message/${encodeURIComponent(capturedId)}`)
  ).json();
  if (message.Text?.trim() !== text) throw new Error("Captured SMTP probe body differs");
} finally {
  // Mailpit deletes everything for an empty IDs array; only pass the matched fixture ID.
  await api("messages", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ IDs: [capturedId] }),
  });
}
console.log(
  JSON.stringify({ smtp: "accepted", tls: "verified", captured: true, fixtureRemoved: true }),
);
