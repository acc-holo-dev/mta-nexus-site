import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { AccountMailCipher } from "./account-mail-crypto";
import { AccountMailDispatcher } from "./account-mail-dispatcher";
import type { MailLease, PreparedAccountMail } from "./account-mail-worker";
import type { AccountMailTransportInput, AccountMailTransportResult } from "./account-mail-smtp";

const cipher = new AccountMailCipher("test", { test: randomBytes(32) });
const lease: MailLease = Object.freeze({
  id: "ame_test",
  token: randomBytes(32).toString("base64url"),
  attempt: 1,
  expiresAt: new Date(Date.now() + 60_000),
});
const prepared: PreparedAccountMail = Object.freeze({
  id: "ame_test",
  challengeId: "ach_test",
  userId: "usr_test",
  purpose: "password_reset",
  expiresAt: new Date(Date.now() + 60_000),
  recipient: "user@example.invalid",
  token: randomBytes(32).toString("base64url"),
  sendBefore: new Date(Date.now() + 30_000),
});

function workerFixture(options: { prepareError?: boolean; candidate?: boolean } = {}) {
  const outcomes: string[] = [];
  return {
    outcomes,
    worker: {
      candidates: async () => (options.candidate === false ? [] : [lease.id]),
      claim: async () => lease,
      prepare: async () => {
        if (options.prepareError) throw new Error("synthetic decrypt failure");
        return prepared;
      },
      settle: async (_lease: MailLease, outcome: "accepted" | "retry" | "discard") => {
        outcomes.push(outcome);
        return true;
      },
      discardUnavailable: async () => 0,
    },
  };
}

function fixture(
  result: AccountMailTransportResult,
  options: { prepareError?: boolean; candidate?: boolean } = {},
) {
  let sent: AccountMailTransportInput | undefined;
  const w = workerFixture(options);
  const transport = {
    send: async (input: AccountMailTransportInput) => {
      sent = input;
      return result;
    },
  };
  const dispatcher = new AccountMailDispatcher({
    worker: w.worker,
    cipher,
    transport,
    appUrl: "https://nexus-mta.test",
  });
  return { dispatcher, outcomes: w.outcomes, sent: () => sent };
}

describe("D2c account mail dispatcher", () => {
  it.each([
    [
      "accepted",
      { outcome: "accepted", uncertain: false, stage: "final_reply" } as const,
      "accepted",
    ],
    ["retry", { outcome: "retry", uncertain: false, stage: "connect" } as const, "retried"],
    ["discard", { outcome: "discard", uncertain: false, stage: "rcpt_to" } as const, "discarded"],
  ])("settles %s transport outcomes", async (_name, result, count) => {
    const f = fixture(result);
    const summary = await f.dispatcher.runBatch();
    expect(f.outcomes).toEqual([result.outcome]);
    expect(summary[count as "accepted" | "retried" | "discarded"]).toBe(1);
  });

  it("keeps the token out of the request URL query", async () => {
    const f = fixture({ outcome: "accepted", uncertain: false, stage: "final_reply" });
    await f.dispatcher.runBatch();
    const sent = f.sent();
    expect(sent).toBeTruthy();
    if (!sent) throw new Error("Expected one outbound account mail");
    expect(sent.text).toContain(
      "https://nexus-mta.test/auth/reset-password?challenge=ach_test#token=",
    );
    const link = sent.text.split("\n").find((line) => line.startsWith("https://"));
    if (!link) throw new Error("Expected reset link in outbound account mail");
    const url = new URL(link);
    expect(url.searchParams.get("challenge")).toBe("ach_test");
    expect(url.search).not.toContain(prepared.token);
    expect(url.hash).toContain(prepared.token);
  });

  it("turns prepare failures into an explicit retry without exposing plaintext", async () => {
    const f = fixture(
      { outcome: "accepted", uncertain: false, stage: "final_reply" },
      { prepareError: true },
    );
    const summary = await f.dispatcher.runBatch();
    expect(f.outcomes).toEqual(["retry"]);
    expect(summary.retried).toBe(1);
    expect(f.sent()).toBeUndefined();
  });

  it("returns only counters when there is no work", async () => {
    const f = fixture(
      { outcome: "accepted", uncertain: false, stage: "final_reply" },
      { candidate: false },
    );
    expect(await f.dispatcher.runBatch()).toEqual({
      accepted: 0,
      retried: 0,
      discarded: 0,
      skipped: 0,
      unsettled: 0,
      cleaned: 0,
    });
  });

  it("rejects non-HTTPS application URLs", () => {
    const w = workerFixture();
    expect(
      () =>
        new AccountMailDispatcher({
          worker: w.worker,
          cipher,
          transport: {
            send: async () => ({
              outcome: "accepted" as const,
              uncertain: false,
              stage: "final_reply" as const,
            }),
          },
          appUrl: "http://localhost:3000",
        }),
    ).toThrow("Invalid account mail application URL");
  });

  it("renders local recovery links with fragment-only tokens when explicitly enabled", async () => {
    const w = workerFixture();
    let sent: AccountMailTransportInput | undefined;
    const dispatcher = new AccountMailDispatcher({
      worker: w.worker,
      cipher,
      appUrl: "http://localhost:3001",
      allowLocalHttp: true,
      transport: {
        send: async (input) => {
          sent = input;
          return { outcome: "accepted", uncertain: false, stage: "final_reply" };
        },
      },
    });
    expect((await dispatcher.runBatch()).accepted).toBe(1);
    const link = sent?.text.split("\n").find((line) => line.startsWith("http://"));
    if (!link) throw new Error("Expected local recovery link");
    const url = new URL(link);
    expect(url.origin).toBe("http://localhost:3001");
    expect(url.searchParams.get("challenge")).toBe("ach_test");
    expect(url.search).not.toContain(prepared.token);
    expect(url.hash).toContain(prepared.token);
  });
});

it("reports progress throughout a multi-message dispatch batch", async () => {
  const ids = ["ame_progress_1", "ame_progress_2"];
  const leases = new Map(
    ids.map((id) => [
      id,
      Object.freeze({
        ...lease,
        id,
      }) satisfies MailLease,
    ]),
  );
  let progress = 0;

  const dispatcher = new AccountMailDispatcher({
    worker: {
      candidates: async () => ids,
      claim: async (id: string) => leases.get(id) ?? null,
      prepare: async (current: MailLease) =>
        Object.freeze({
          ...prepared,
          id: current.id,
          challengeId: `ach_${current.id}`,
        }),
      settle: async () => true,
      discardUnavailable: async () => 0,
    },
    cipher,
    transport: {
      send: async () => ({
        outcome: "accepted" as const,
        uncertain: false,
        stage: "final_reply" as const,
      }),
    },
    appUrl: "https://nexus.test",
  });

  await dispatcher.runBatch(10, undefined, () => {
    progress += 1;
  });

  expect(progress).toBe(ids.length + 2);
});
