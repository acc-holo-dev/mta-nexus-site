import { describe, expect, it } from "vitest";
import {
  batches,
  createHash,
  db,
  eq,
  fixture,
  identity,
  randomUUID,
  sessionRepository,
  sessions,
  state,
} from "../helpers/library-selection-batches-session-harness";

describe("library selection batches session: auth rejection and replay", () => {
  for (const invalid of [
    "missing",
    "unknown",
    "digest",
    "foreign",
    "expired",
    "revoked",
  ] as const) {
    it(`rejects new commands and exact replays with a ${invalid} initiating session`, async () => {
      const f = await fixture();
      await batches.command(f.input);
      const before = await state(f);
      let token = f.token;
      if (invalid === "missing") token = "";
      if (invalid === "unknown") token = `unknown-${randomUUID()}`;
      if (invalid === "digest") token = createHash("sha256").update(token).digest("hex");
      if (invalid === "foreign") token = (await identity()).token;
      if (invalid === "expired")
        await db
          .update(sessions)
          .set({ expiresAt: new Date(0) })
          .where(eq(sessions.id, f.sessionId));
      if (invalid === "revoked") await sessionRepository.delete(token);
      for (const command of [f.input.command, { ...f.input.command, requestId: randomUUID() }])
        await expect(
          batches.command({ ...f.input, currentToken: token, command }),
        ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      expect(await state(f)).toEqual(before);
    });
  }

  it("applies once and replays the same receipt without leaking its initiating token", async () => {
    const f = await fixture(),
      result = await batches.command(f.input);
    expect(result.replayed).toBe(false);
    expect(await batches.command(f.input)).toEqual({ ...result, replayed: true });
    const saved = await state(f);
    expect([saved.selections.length, saved.receipts.length, saved.audits.length]).toEqual([
      1, 1, 2,
    ]);
    expect(JSON.stringify(saved)).not.toContain(f.token);
    expect(JSON.stringify(saved)).not.toContain(createHash("sha256").update(f.token).digest("hex"));
  });

  it("rejects a valid foreign caller before reading or changing another owner's batch", async () => {
    const f = await fixture(),
      other = await identity(),
      before = await state(f);
    await expect(
      batches.command({ ...f.input, userId: other.userId, currentToken: other.token }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(await state(f)).toEqual(before);
  });
});
