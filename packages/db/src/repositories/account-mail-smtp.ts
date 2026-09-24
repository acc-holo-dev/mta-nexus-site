import { createInterface } from "node:readline";
import { once } from "node:events";
import tls from "node:tls";

export type AccountMailTransportInput = Readonly<{
  recipient: string;
  subject: string;
  text: string;
  sendBefore: Date;
}>;

export type AccountMailTransportResult = Readonly<{
  outcome: "accepted" | "retry" | "discard";
  uncertain: boolean;
  code?: number;
}>;

export type AccountMailSmtpOptions = Readonly<{
  host: string;
  port: number;
  servername: string;
  from: string;
  ca?: string | Buffer;
  timeoutMs?: number;
}>;

function validAddress(value: string): boolean {
  return typeof value === "string" && value.length >= 3 && value.length <= 320
    && !/[\r\n]/.test(value) && /^[^\s@<>]+@[^\s@<>]+$/.test(value);
}

function validateOptions(options: AccountMailSmtpOptions) {
  if (!options || typeof options !== "object"
    || typeof options.host !== "string" || options.host.length < 1 || options.host.length > 253
    || !Number.isInteger(options.port) || options.port < 1 || options.port > 65535
    || typeof options.servername !== "string" || options.servername.length < 1 || options.servername.length > 253
    || !validAddress(options.from)) throw new Error("Invalid SMTP transport configuration");
  const timeout = options.timeoutMs ?? 5_000;
  if (!Number.isInteger(timeout) || timeout < 100 || timeout > 30_000) {
    throw new Error("Invalid SMTP transport timeout");
  }
  return timeout;
}

function classify(code: number, uncertain = false): AccountMailTransportResult {
  if (code >= 200 && code < 300) return { outcome: "accepted", uncertain, code };
  if (code >= 400 && code < 500) return { outcome: "retry", uncertain, code };
  return { outcome: "discard", uncertain, code };
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
    || !(input.sendBefore instanceof Date) || !Number.isFinite(input.sendBefore.getTime())) {
    throw new Error("Invalid account mail message");
  }
}

// Minimal implicit-TLS SMTP adapter for the account recovery dispatcher.
// It deliberately has no plaintext fallback and no logging of envelope/message data.
// Authentication/provider-specific behavior remains a later production integration.
export class AccountMailSmtpTransport {
  #options: AccountMailSmtpOptions;
  #timeoutMs: number;

  constructor(options: AccountMailSmtpOptions) {
    this.#timeoutMs = validateOptions(options);
    this.#options = Object.freeze({ ...options });
  }

  async send(input: AccountMailTransportInput): Promise<AccountMailTransportResult> {
    validateMessage(input);
    const remaining = input.sendBefore.getTime() - Date.now();
    if (remaining <= 0) return { outcome: "retry", uncertain: false };
    const budget = Math.max(1, Math.min(this.#timeoutMs, remaining));
    let dataSent = false;
    const socket = tls.connect({
      host: this.#options.host,
      port: this.#options.port,
      servername: this.#options.servername,
      ca: this.#options.ca,
      rejectUnauthorized: true,
    });
    socket.setTimeout(budget, () => socket.destroy(new Error("SMTP timeout")));
    const lines = createInterface({ input: socket, crlfDelay: Infinity });
    const iterator = lines[Symbol.asyncIterator]();

    const readReply = async (): Promise<number> => {
      let expected = "";
      for (;;) {
        const next = await iterator.next();
        if (next.done || typeof next.value !== "string") throw new Error("SMTP connection closed");
        const match = /^(\d{3})([ -])/.exec(next.value);
        if (!match) throw new Error("Invalid SMTP response");
        expected ||= match[1];
        if (match[1] !== expected) throw new Error("Invalid SMTP response sequence");
        if (match[2] === " ") return Number(match[1]);
      }
    };
    const command = async (value: string) => {
      if (!socket.write(`${value}\r\n`, "utf8")) await once(socket, "drain");
      return readReply();
    };
    const requireStage = (code: number, expected: number | number[]) => {
      const allowed = Array.isArray(expected) ? expected : [expected];
      return allowed.includes(code) ? null : classify(code);
    };

    try {
      await once(socket, "secureConnect");
      let code = await readReply();
      let result = requireStage(code, 220);
      if (result) return result;

      code = await command(`EHLO ${this.#options.servername}`);
      result = requireStage(code, 250);
      if (result) return result;

      code = await command(`MAIL FROM:<${this.#options.from}>`);
      result = requireStage(code, 250);
      if (result) return result;

      code = await command(`RCPT TO:<${input.recipient}>`);
      result = requireStage(code, [250, 251]);
      if (result) return result;

      code = await command("DATA");
      result = requireStage(code, 354);
      if (result) return result;

      const message = [
        `From: <${this.#options.from}>`,
        `To: <${input.recipient}>`,
        `Subject: ${input.subject}`,
        "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=UTF-8",
        "Content-Transfer-Encoding: 8bit",
        "",
        dotStuff(input.text),
        ".",
        "",
      ].join("\r\n");
      dataSent = true;
      if (!socket.write(message, "utf8")) await once(socket, "drain");
      code = await readReply();
      result = requireStage(code, 250);
      if (result) return { ...result, uncertain: dataSent };
      try { await command("QUIT"); } catch { /* acceptance already confirmed */ }
      return { outcome: "accepted", uncertain: false, code };
    } catch {
      return { outcome: "retry", uncertain: dataSent };
    } finally {
      lines.close();
      socket.destroy();
    }
  }
}
