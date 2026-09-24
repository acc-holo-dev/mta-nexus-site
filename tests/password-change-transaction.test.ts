import { describe, expect, it } from "vitest";
import { auditRepository, authRepository, sessionRepository, userRepository } from "@nexus/db";
import { generateId, generateSessionToken, hashPassword, verifyPassword } from "@nexus/security";
import { authService } from "../apps/web/src/lib/services/auth-service";

const oldPassword = "Synthetic-old-password-005b!";
const nextPassword = "Synthetic-new-password-005b!";
const audit = (userId: string, id = generateId("aud")) => ({
  id, actorId: userId, actorType: "user" as const,
  action: "user.password_changed", targetId: userId, targetType: "user",
});
async function account() {
  const username = `pw_${generateId("t").slice(-18)}`;
  const input = { username, email: `${username}@example.invalid`, password: oldPassword };
  const first = await authService.register(input);
  const second = await authService.login(input);
  const stored = await userRepository.findByEmail(input.email);
  if (!stored?.passwordHash) throw new Error("Missing test account hash");
  return { ...first, otherToken: second.token, input, hash: stored.passwordHash };
}

// Uses the CI test database and random synthetic accounts, not mocks or seed personas.
describe("password change transaction", () => {
  it("wrong current password preserves credentials and both sessions", async () => {
    const a = await account();
    await expect(authService.changePassword({ userId: a.user.id, currentToken: a.token,
      currentPassword: "Incorrect-current-password", newPassword: nextPassword })).rejects.toThrow("Current password is incorrect");
    expect((await userRepository.findByEmail(a.input.email))?.passwordHash).toBe(a.hash);
    expect((await authService.getSession(a.token))?.id).toBe(a.user.id);
    expect((await authService.getSession(a.otherToken))?.id).toBe(a.user.id);
  });

  it("rotates this token without extending expiry and invalidates every old token", async () => {
    const a = await account();
    const before = await sessionRepository.findValidSession(a.token);
    const result = await authService.changePassword({ userId: a.user.id, currentToken: a.token,
      currentPassword: oldPassword, newPassword: nextPassword });
    expect(result.revokedSessionCount).toBe(1);
    expect(result.token !== a.token).toBe(true);
    expect(result.expiresAt.getTime()).toBe(new Date(before!.session.expiresAt).getTime());
    expect(await authService.getSession(a.token)).toBeNull();
    expect(await authService.getSession(a.otherToken)).toBeNull();
    expect((await authService.getSession(result.token))?.id).toBe(a.user.id);
    await expect(authService.login(a.input)).rejects.toThrow("Invalid email or password");
    expect((await authService.login({ ...a.input, password: nextPassword })).user.id).toBe(a.user.id);
  });

  it("does not accept another account's session even with the victim's password", async () => {
    const a = await account();
    const b = await account();
    await expect(authService.changePassword({ userId: a.user.id, currentToken: b.token,
      currentPassword: oldPassword, newPassword: nextPassword })).rejects.toThrow("Authentication required");
    expect((await userRepository.findByEmail(a.input.email))?.passwordHash).toBe(a.hash);
    expect((await authService.getSession(a.otherToken))?.id).toBe(a.user.id);
    expect((await authService.getSession(b.token))?.id).toBe(b.user.id);
  });

  it("rolls back password, revoked sessions and token rotation when audit insertion fails", async () => {
    const a = await account();
    const existing = audit(a.user.id);
    await auditRepository.record(existing);
    const nextToken = generateSessionToken();
    await expect(authRepository.changePassword({ userId: a.user.id,
      expectedPasswordHash: a.hash, passwordHash: await hashPassword(nextPassword),
      currentToken: a.token, nextToken, audit: existing })).rejects.toThrow();
    expect((await userRepository.findByEmail(a.input.email))?.passwordHash).toBe(a.hash);
    expect((await authService.getSession(a.token))?.id).toBe(a.user.id);
    expect((await authService.getSession(a.otherToken))?.id).toBe(a.user.id);
    expect(await authService.getSession(nextToken)).toBeNull();
  });

  it("allows only one of two changes based on the same credential snapshot", async () => {
    const a = await account();
    const tokens = [generateSessionToken(), generateSessionToken()];
    const passwords = [nextPassword, "Different-next-password-005b!"];
    const hashes = await Promise.all(passwords.map(hashPassword));
    const results = await Promise.allSettled(tokens.map((nextToken, i) => authRepository.changePassword({
      userId: a.user.id, expectedPasswordHash: a.hash, passwordHash: hashes[i],
      currentToken: i === 0 ? a.token : a.otherToken, nextToken, audit: audit(a.user.id),
    })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    const winner = results.findIndex((r) => r.status === "fulfilled");
    const stored = await userRepository.findByEmail(a.input.email);
    expect(await verifyPassword(passwords[winner], stored!.passwordHash!)).toBe(true);
    expect((await authService.getSession(tokens[winner]))?.id).toBe(a.user.id);
    expect(await authService.getSession(tokens[1 - winner])).toBeNull();
    expect(await authService.getSession(a.token)).toBeNull();
    expect(await authService.getSession(a.otherToken)).toBeNull();
  });

  it("rejects a login commit whose verified hash became obsolete", async () => {
    const a = await account();
    await authService.changePassword({ userId: a.user.id, currentToken: a.token,
      currentPassword: oldPassword, newPassword: nextPassword });
    const lateToken = generateSessionToken();
    await expect(authRepository.createLoginSession({ id: generateId("ses"), userId: a.user.id,
      token: lateToken, expiresAt: new Date(Date.now() + 60_000) },
      { ...audit(a.user.id), action: "user.logged_in" }, a.hash)).rejects.toThrow("Invalid email or password");
    expect(await authService.getSession(lateToken)).toBeNull();
  });
});
