import { createInterface } from "node:readline";
import { once } from "node:events";
import net from "node:net";
import tls from "node:tls";

export type AccountMailTransportInput = Readonly<{
  recipient: string;
  subject: string;
  text: string;
  sendBefore: Date;
  messageId: string;
}>;

export type AccountMailTransportResult = Readonly<{
  outcome: "accepted" | "retry" | "discard";
  uncertain: boolean;
  code?: number;
}>;

export type AccountMailSmtpMode = "implicit_tls" | "starttls";

export type AccountMailSmtpOptions = Readonly<{
  host: string;
  port: number;
  servername: string;
  from: string;
  mode?: AccountMailSmtpMode;
  username?: string;
  password?: string;
  ca?: string | Buffer;
  timeoutMs?: number;
}>;

type SmtpSession = {
  socket: net.Socket;
  lines: ReturnType<typeof createInterface>;
  iterator: AsyncIterator<string>;
};

function validAddress(value: string): boolean {
  return typeof value === "string" && value.length >= 3 && value.length <= 320
    && !/[\r\n]/.test(value) && /^[^\s@<>]+@[^\s@<>]+$/.test(value);
}

function validateOptions(options: AccountMailSmtpOptions) {
  if (!options || typeof options !== "object"
    || typeof options.host !== "string" || options.host.length < 1 || options.host.length > 253
    || !Number.isInteger(options.port) || options.port < 1 || options.port > 65535
    || typeof options.servername !== "string" || options.servername.length < 1 || options.servername.length > 253
    || !validAddress(options.from)
    || !["implicit_tls", "starttls"].includes(options.mode ?? "implicit_tls")) {
    throw new Error("Invalid SMTP transport configuration");
  }
  const hasUsername = typeof options.username === "string" && options.username.length > 0;
  const hasPassword = typeof options.password === "string" && options.password.length > 0;
  if (hasUsername !== hasPassword
    || (hasUsername && (options.username!.length > 320 || /[\r\n\0]/.test(options.username!)))
    || (hasPassword && (options.password!.length > 1024 || /[\r\n\0]/.test(options.password!)))) {
    throw new Error("Invalid SMTP authentication configuration");
  }
  const timeout = options.timeoutMs ?? 5_000;
  if (!Number.isInteger(timeout) || timeout < 100 || timeout > 30_000) {
    throw new Error("Invalid SMTP transport timeout");
  }
  return timeout;
}

function classify(code: number, permanent: "retry" | "discard" = "discard"): AccountMailTransportResult {
  if (code >= 200 && code < 300) return { outcome: "accepted", uncertain: false, code };
  if (code >= 400 && code < 500) return { outcome: "retry", uncertain: false, code };
  return { outcome: permanent, uncertain: false, code };
}

function dotStuff(text: string): string {
  return text.replace(/\r?\n/g, "\r\n").split("\r\n")
    .map((line) => line.startsWith(".") ? `.${line}` : line).join("\r\n");
}

function validateMessage(input: AccountMailTransportInput) {
  if (!input || !validAddress(input.recipient)
    || typeof input.subject !== "string" || input.subject.length < 1 || input.subject.length > 160
    || /[\r\n]/.test(input.subject)
    || typeof input.text !== "string" || Buffer.byteLength(input.text, "utf8") > 16_384
    || typeof input.messageId !== "string" || !/^ame_[A-Za-z0-9_-]{1,96}$/.test(input.messageId)
    || !(input.sendBefore instanceof Date) || !Number.isFinite(input.sendBefore.getTime())) {
    throw new Error("Invalid account mail message");
  }
}

function createSession(socket: net.Socket): SmtpSession {
  const lines = createInterface({ input: socket, crlfDelay: Infinity });
  return { socket, lines, iterator: lines[Symbol.asyncIterator]() };
}

function closeSession(session: SmtpSession | null) {
  if (!session) return;
  session.lines.close();
}

async function readReply(session: SmtpSession): Promise<{ code: number; lines: string[] }> {
  let expected = "";
  const replyLines: string[] = [];
  for (;;) {
    const next = await session.iterator.next();
    if (next.done || typeof next.value !== "string") throw new Error("SMTP connection closed");
    const match = /^(\d{3})([ -])(.*)$/.exec(next.value);
    if (!match) throw new Error("Invalid SMTP response");
    expected ||= match[1];
    if (match[1] !== expected) throw new Error("Invalid SMTP response sequence");
    replyLines.push(match[3]);
    if (match[2] === " ") return { code: Number(match[1]), lines: replyLines };
  }
}

async function command(session: SmtpSession, value: string) {
  if (!session.socket.write(`${value}\r\n`, "utf8")) await once(session.socket, "drain");
  return readReply(session);
}

function requireStage(
  code: number,
  expected: number | number[],
  permanent: "retry" | "discard" = "discard",
) {
  const allowed = Array.isArray(expected) ? expected : [expected];
  return allowed.includes(code) ? null : classify(code, permanent);
}

function advertisesStartTls(lines: string[]): boolean {
  return lines.some((line) => /^STARTTLS(?:\s|$)/i.test(line.trim()));
}

function advertisesAuthPlain(lines: string[]): boolean {
  return lines.some((line) => {
    const match = /^AUTH(?:=|\s+)(.*)$/i.exec(line.trim());
    return Boolean(match?.[1]?.split(/\s+/).some((mechanism) => mechanism.toUpperCase() === "PLAIN"));
  });
}

function advertisesCapability(lines: string[], capability: string): boolean {
  const expected = capability.toUpperCase();
  return lines.some((line) => line.trim().split(/\s+/, 1)[0]?.toUpperCase() === expected);
}

function containsNonAscii(value: string): boolean {
  return /[^\x00-\x7f]/.test(value);
}

// SMTP transport for account recovery mail. It supports either implicit TLS
// or mandatory STARTTLS upgrade. AUTH/envelope/message data are never sent on
// the plaintext side of a STARTTLS connection. There is no plaintext fallback.
export class AccountMailSmtpTransport {
  #options: AccountMailSmtpOptions;
  #timeoutMs: number;
  #mode: AccountMailSmtpMode;

  constructor(options: AccountMailSmtpOptions) {
    this.#timeoutMs = validateOptions(options);
    this.#mode = options.mode ?? "implicit_tls";
    this.#options = Object.freeze({ ...options, mode: this.#mode });
  }

  async send(input: AccountMailTransportInput): Promise<AccountMailTransportResult> {
    validateMessage(input);
    const remaining = input.sendBefore.getTime() - Date.now();
    if (remaining <= 0) return { outcome: "retry", uncertain: false };
    const budget = Math.max(1, Math.min(this.#timeoutMs, remaining));
    const deadlineAt = Date.now() + Math.max(1, remaining);
    let dataSent = false;
    let capabilities: string[] = [];
    let session: SmtpSession | null = null;
    let socket: net.Socket | null = null;

    const applyTimeout = (target: net.Socket) => {
      target.setTimeout(budget, () => target.destroy(new Error("SMTP inactivity timeout")));
    };
    const deadlineTimer = setTimeout(() => {
      socket?.destroy(new Error("SMTP send deadline exceeded"));
    }, Math.max(1, deadlineAt - Date.now()));
    deadlineTimer.unref();

    const ensureWithinDeadline = () => {
      if (Date.now() >= deadlineAt) throw new Error("SMTP send deadline exceeded");
    };

    try {
      ensureWithinDeadline();
      if (this.#mode === "implicit_tls") {
        const secure = tls.connect({
          host: this.#options.host,
          port: this.#options.port,
          servername: this.#options.servername,
          ca: this.#options.ca,
          rejectUnauthorized: true,
        });
        socket = secure;
        applyTimeout(secure);
        await once(secure, "secureConnect");
        session = createSession(secure);

        ensureWithinDeadline();
        const greeting = await readReply(session);
        let result = requireStage(greeting.code, 220, "retry");
        if (result) return result;

        ensureWithinDeadline();
        const ehlo = await command(session, `EHLO ${this.#options.servername}`);
        result = requireStage(ehlo.code, 250, "retry");
        if (result) return result;
        capabilities = ehlo.lines;
      } else {
        const plain = net.connect({
          host: this.#options.host,
          port: this.#options.port,
        });
        socket = plain;
        applyTimeout(plain);
        await once(plain, "connect");
        session = createSession(plain);

        const greeting = await readReply(session);
        let result = requireStage(greeting.code, 220, "retry");
        if (result) return result;

        ensureWithinDeadline();
        const plainEhlo = await command(session, `EHLO ${this.#options.servername}`);
        result = requireStage(plainEhlo.code, 250, "retry");
        if (result) return result;
        if (!advertisesStartTls(plainEhlo.lines)) {
          return { outcome: "retry", uncertain: false };
        }

        ensureWithinDeadline();
        const startTls = await command(session, "STARTTLS");
        result = requireStage(startTls.code, 220, "retry");
        if (result) return result;

        closeSession(session);
        session = null;
        plain.setTimeout(0);

        const secure = tls.connect({
          socket: plain,
          servername: this.#options.servername,
          ca: this.#options.ca,
          rejectUnauthorized: true,
        });
        socket = secure;
        applyTimeout(secure);
        await once(secure, "secureConnect");
        session = createSession(secure);

        ensureWithinDeadline();
        const secureEhlo = await command(session, `EHLO ${this.#options.servername}`);
        result = requireStage(secureEhlo.code, 250, "retry");
        if (result) return result;
        capabilities = secureEhlo.lines;
      }

      if (!session) throw new Error("SMTP session unavailable");

      if (this.#options.username && this.#options.password) {
        if (!advertisesAuthPlain(capabilities)) {
          return { outcome: "retry", uncertain: false };
        }
        const auth = Buffer.from(
          `\0${this.#options.username}\0${this.#options.password}`,
          "utf8",
        ).toString("base64");
        ensureWithinDeadline();
        const authReply = await command(session, `AUTH PLAIN ${auth}`);
        const result = requireStage(authReply.code, 235, "retry");
        if (result) return result;
      }

      const needsSmtpUtf8 = containsNonAscii(this.#options.from)
        || containsNonAscii(input.recipient)
        || containsNonAscii(input.subject);
      const needs8BitMime = containsNonAscii(input.text);
      if (needsSmtpUtf8 && !advertisesCapability(capabilities, "SMTPUTF8")) {
        return { outcome: "discard", uncertain: false };
      }
      if (needs8BitMime && !advertisesCapability(capabilities, "8BITMIME")) {
        return { outcome: "discard", uncertain: false };
      }
      const mailParameters = [
        needsSmtpUtf8 ? "SMTPUTF8" : "",
        needs8BitMime ? "BODY=8BITMIME" : "",
      ].filter(Boolean).join(" ");

      ensureWithinDeadline();
      const mailFrom = await command(
        session,
        `MAIL FROM:<${this.#options.from}>${mailParameters ? ` ${mailParameters}` : ""}`,
      );
      let result = requireStage(mailFrom.code, 250, "retry");
      if (result) return result;

      ensureWithinDeadline();
      const recipient = await command(session, `RCPT TO:<${input.recipient}>`);
      result = requireStage(recipient.code, [250, 251]);
      if (result) return result;

      ensureWithinDeadline();
      const data = await command(session, "DATA");
      result = requireStage(data.code, 354);
      if (result) return result;

      const fromDomain = this.#options.from.slice(this.#options.from.lastIndexOf("@") + 1);
      const message = [
        `From: <${this.#options.from}>`,
        `To: <${input.recipient}>`,
        `Subject: ${input.subject}`,
        `Date: ${new Date().toUTCString()}`,
        `Message-ID: <${input.messageId}@${fromDomain}>`,
        "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=UTF-8",
        needs8BitMime ? "Content-Transfer-Encoding: 8bit" : "Content-Transfer-Encoding: 7bit",
        "",
        dotStuff(input.text),
        ".",
        "",
      ].join("\r\n");

      ensureWithinDeadline();
      dataSent = true;
      if (!session.socket.write(message, "utf8")) await once(session.socket, "drain");
      ensureWithinDeadline();
      const accepted = await readReply(session);
      result = requireStage(accepted.code, 250);
      if (result) return result;

      try { await command(session, "QUIT"); } catch { /* acceptance already confirmed */ }
      return { outcome: "accepted", uncertain: false, code: accepted.code };
    } catch {
      return { outcome: "retry", uncertain: dataSent };
    } finally {
      clearTimeout(deadlineTimer);
      closeSession(session);
      socket?.destroy();
    }
  }
}
