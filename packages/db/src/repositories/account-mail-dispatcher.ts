import { AccountMailCipher } from "./account-mail-crypto";
import { accountMailWorkerRepository } from "./account-mail-worker";
import type { MailLease, PreparedAccountMail } from "./account-mail-worker";
import type { AccountMailTransportInput, AccountMailTransportResult } from "./account-mail-smtp";

type Worker = Readonly<{
  candidates(limit?: number): Promise<string[]>;
  claim(id: string): Promise<MailLease | null>;
  prepare(lease: MailLease, cipher: AccountMailCipher): Promise<PreparedAccountMail | null>;
  settle(
    lease: MailLease,
    outcome: "accepted" | "retry" | "discard",
    auditId?: string,
    transport?: Readonly<{ smtpCode?: number; uncertain?: boolean }>,
  ): Promise<boolean>;
  discardUnavailable(limit?: number): Promise<number>;
}>;

type Transport = Readonly<{
  send(input: AccountMailTransportInput): Promise<AccountMailTransportResult>;
}>;

export type AccountMailDispatchSummary = Readonly<{
  accepted: number;
  retried: number;
  discarded: number;
  skipped: number;
  unsettled: number;
  cleaned: number;
}>;

function checkedBaseUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("Invalid account mail application URL");
  }
  return url;
}

function messageFor(mail: PreparedAccountMail, base: URL): AccountMailTransportInput {
  const path = mail.purpose === "email_verify" ? "/auth/verify-email" : "/auth/reset-password";
  const url = new URL(path, base);
  url.searchParams.set("challenge", mail.challengeId);
  // The secret stays in the fragment so the initial page request/proxy log does
  // not receive it. The future UI must remove the fragment before confirmation.
  url.hash = `token=${encodeURIComponent(mail.token)}`;
  const subject = mail.purpose === "email_verify"
    ? "Confirm your MTA NEXUS email"
    : "Reset your MTA NEXUS password";
  const text = mail.purpose === "email_verify"
    ? `Confirm this email address for your MTA NEXUS account:\n\n${url.toString()}\n\nIf you did not request this, ignore this message.`
    : `Use this link to reset your MTA NEXUS password:\n\n${url.toString()}\n\nIf you did not request this, ignore this message.`;
  return {
    recipient: mail.recipient,
    subject,
    text,
    sendBefore: mail.sendBefore,
    messageId: mail.id,
  };
}

// No scheduler and no SMTP configuration are hidden here. The caller owns both.
// Each DB method commits before transport.send, so network I/O never holds a DB
// write transaction. Summary values contain no recipient, token or message body.
export class AccountMailDispatcher {
  #worker: Worker;
  #cipher: AccountMailCipher;
  #transport: Transport;
  #baseUrl: URL;

  constructor(input: { worker?: Worker; cipher: AccountMailCipher; transport: Transport; appUrl: string }) {
    if (!input?.cipher || !input?.transport) throw new Error("Invalid account mail dispatcher");
    this.#worker = input.worker ?? accountMailWorkerRepository;
    this.#cipher = input.cipher;
    this.#transport = input.transport;
    this.#baseUrl = checkedBaseUrl(input.appUrl);
  }

  async runBatch(limit = 10): Promise<AccountMailDispatchSummary> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("Invalid dispatch batch limit");
    const summary = { accepted: 0, retried: 0, discarded: 0, skipped: 0, unsettled: 0, cleaned: 0 };
    const ids = await this.#worker.candidates(limit);
    for (const id of ids) {
      const lease = await this.#worker.claim(id);
      if (!lease) { summary.skipped++; continue; }
      let prepared: PreparedAccountMail | null;
      try {
        prepared = await this.#worker.prepare(lease, this.#cipher);
      } catch {
        const settled = await this.#worker.settle(lease, "retry");
        if (settled) summary.retried++; else summary.unsettled++;
        continue;
      }
      if (!prepared) { summary.skipped++; continue; }
      const result = await this.#transport.send(messageFor(prepared, this.#baseUrl));
      const settled = await this.#worker.settle(
        lease,
        result.outcome,
        undefined,
        { smtpCode: result.code, uncertain: result.uncertain },
      );
      if (!settled) {
        summary.unsettled++;
      } else if (result.outcome === "accepted") {
        summary.accepted++;
      } else if (result.outcome === "retry") {
        summary.retried++;
      } else {
        summary.discarded++;
      }
    }
    summary.cleaned = await this.#worker.discardUnavailable(Math.min(limit, 100));
    return Object.freeze(summary);
  }
}
