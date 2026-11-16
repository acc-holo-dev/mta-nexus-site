import {
  licenseControlsRepository as controls,
  db,
  sessionRepository,
  sessions,
  users,
} from "@nexus/db";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  account,
  block,
  fixture,
  moderation,
  setupLicenseCommandSession,
  snapshot,
  waitForLock,
} from "../helpers/license-command-session-harness";

setupLicenseCommandSession();

describe("license command session: auth rejection and lock-wait rechecks", () => {
  for (const invalid of ["revoked", "expired", "foreign", "missing"] as const) {
    it(`rejects owner and moderator writes with a ${invalid} initiating session without changing credentials or audit`, async () => {
      const f = await fixture();
      let currentToken = f.token;
      if (invalid === "revoked") await sessionRepository.delete(f.token);
      if (invalid === "expired")
        await db
          .update(sessions)
          .set({ expiresAt: new Date(0) })
          .where(eq(sessions.id, f.sessionId));
      if (invalid === "foreign") currentToken = (await account()).token;
      if (invalid === "missing") currentToken = "";
      const before = await snapshot(f);
      await expect(controls.ownerCommand({ ...f.input, currentToken })).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
      await expect(controls.moderate({ ...moderation(f), currentToken })).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
      expect(await snapshot(f)).toEqual(before);
    });
  }

  it("checks current ownership and the moderator role despite a live initiating session", async () => {
    const f = await fixture();
    const stranger = await account();
    const before = await snapshot(f);
    await expect(
      controls.ownerCommand({ ...f.input, actorId: stranger.userId, currentToken: stranger.token }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await db.update(users).set({ role: "user" }).where(eq(users.id, f.userId));
    await expect(controls.moderate(moderation(f))).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await snapshot(f)).toEqual(before);
  });

  it("commits one valid owner command and rejects its replay without a second audit", async () => {
    const f = await fixture();
    const result = await controls.ownerCommand(f.input);
    expect(result.license.updatedAt).not.toBe(f.input.command.expectedUpdatedAt);
    const saved = await snapshot(f);
    expect(saved.binding[0]).toMatchObject({ tokenDigest: null, tokenExpiresAt: null });
    expect(saved.license[0].expiresAt).toEqual(f.expiresAt);
    expect(saved.audit).toHaveLength(1);
    expect(JSON.stringify(saved.audit)).not.toContain(f.token);
    await sessionRepository.delete(f.token);
    await expect(
      controls.ownerCommand({
        ...f.input,
        command: {
          ...f.input.command,
          expectedUpdatedAt: result.license.updatedAt,
        },
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(controls.ownerCommand(f.input)).rejects.toBeDefined();
    expect(await snapshot(f)).toEqual(saved);
  });

  for (const [action, table] of [
    ["owner", "license_runtime_bindings"],
    ["moderator", "licenses"],
  ] as const) {
    it(`rejects ${action} authorization revoked during a ${table} lock wait`, async () => {
      const f = await fixture();
      const before = await snapshot(f);
      const blocker = await block(f, table);
      const pending = (
        action === "owner" ? controls.ownerCommand(f.input) : controls.moderate(moderation(f))
      ).then(
        (value) => ({ value }),
        (error: unknown) => ({ error }),
      );
      try {
        await waitForLock(table);
        await sessionRepository.delete(f.token);
      } finally {
        await blocker.release();
      }
      expect(await pending).toMatchObject({ error: { code: "UNAUTHORIZED" } });
      expect(await snapshot(f)).toEqual(before);
    }, 20000);
  }

  it("rechecks the current moderator after waiting for the license", async () => {
    const f = await fixture();
    const before = await snapshot(f);
    const blocker = await block(f, "licenses");
    const pending = controls.moderate(moderation(f)).then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
    try {
      await waitForLock("licenses");
      await db.update(users).set({ role: "user" }).where(eq(users.id, f.userId));
    } finally {
      await blocker.release();
    }
    expect(await pending).toMatchObject({ error: { code: "FORBIDDEN" } });
    expect(await snapshot(f)).toEqual(before);
  }, 20000);

  it("rejects session expiry during a moderator session-row wait", async () => {
    const f = await fixture();
    const before = await snapshot(f);
    const expiresAt = new Date(Date.now() + 1500);
    await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, f.sessionId));
    const blocker = await block(f, "sessions");
    const pending = controls.moderate(moderation(f)).then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
    try {
      await waitForLock("sessions");
      await expect
        .poll(() => Date.now() >= expiresAt.getTime(), { timeout: 5000, interval: 10 })
        .toBe(true);
    } finally {
      await blocker.release();
    }
    expect(await pending).toMatchObject({ error: { code: "UNAUTHORIZED" } });
    expect(await snapshot(f)).toEqual(before);
  }, 20000);
});
