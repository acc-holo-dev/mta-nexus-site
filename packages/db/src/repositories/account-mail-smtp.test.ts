import { describe, expect, it } from "vitest";
import { AccountMailSmtpTransport } from "./account-mail-smtp";

const options = {
  host: "smtp.example.test",
  port: 465,
  servername: "smtp.example.test",
  from: "noreply@example.test",
};

describe("SMTP authentication configuration", () => {
  it("accepts anonymous delivery and a complete credential pair", () => {
    expect(() => new AccountMailSmtpTransport(options)).not.toThrow();
    expect(
      () =>
        new AccountMailSmtpTransport({
          ...options,
          username: "",
          password: "",
        }),
    ).not.toThrow();
    expect(
      () =>
        new AccountMailSmtpTransport({
          ...options,
          username: "u".repeat(320),
          password: "p".repeat(1024),
        }),
    ).not.toThrow();
  });

  it.each([
    { username: "user" },
    { password: "password" },
    { username: "user", password: "" },
    { username: "", password: "password" },
    { username: "u".repeat(321), password: "password" },
    { username: "user", password: "p".repeat(1025) },
    ...["\r", "\n", "\0"].flatMap((control) => [
      { username: `user${control}`, password: "password" },
      { username: "user", password: `password${control}` },
    ]),
  ])("rejects incomplete, oversized or control-character credentials (%#)", (credentials) => {
    expect(() => new AccountMailSmtpTransport({ ...options, ...credentials })).toThrow(
      "Invalid SMTP authentication configuration",
    );
  });
});
