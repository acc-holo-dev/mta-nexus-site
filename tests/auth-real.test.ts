import { describe, it, expect } from "vitest";
import { sessionRepository } from "@nexus/db";
import { generateId, generateSessionToken } from "@nexus/security";
import { authService } from "../apps/web/src/lib/services/auth-service";

describe("Real Auth & Session Engine", () => {
  const testUser = {
    email: `pilot_${Date.now()}@nexus.test`,
    username: `pilot_${Date.now().toString(36)}`,
    password: "Password123!",
    displayName: "Pilot User",
  };

  it("should successfully register a new user and generate a session token", async () => {
    const result = await authService.register(testUser);
    expect(result.user).toBeDefined();
    expect(result.user.email).toBe(testUser.email.toLowerCase());
    expect(result.user.username).toBe(testUser.username);
    expect(result.user).not.toHaveProperty("passwordHash");
    expect(result.token).toMatch(/^ses_[A-Za-z0-9_-]{43}$/);

    const sessionUser = await authService.getSession(result.token);
    expect(sessionUser).toBeDefined();
    expect(sessionUser?.id).toBe(result.user.id);
    expect(sessionUser).not.toHaveProperty("passwordHash");

    const rawProbeToken = generateSessionToken();
    const stored = await sessionRepository.create({
      id: generateId("ses"),
      userId: result.user.id,
      token: rawProbeToken,
      expiresAt: new Date(Date.now() + 60_000),
    });
    expect(stored.token).not.toBe(rawProbeToken);
    expect(stored.token).toMatch(/^[a-f0-9]{64}$/);
    expect((await authService.getSession(rawProbeToken))?.id).toBe(result.user.id);
    await sessionRepository.delete(rawProbeToken);
  });

  it("should reject duplicate email during registration", async () => {
    await expect(
      authService.register({
        ...testUser,
        username: `diff_${Date.now().toString(36)}`,
      })
    ).rejects.toThrow("already exists");
  });

  it("should reject duplicate username during registration", async () => {
    await expect(
      authService.register({
        ...testUser,
        email: `other_${Date.now()}@nexus.test`,
      })
    ).rejects.toThrow("already taken");
  });

  it("should authenticate with correct password", async () => {
    const result = await authService.login({
      email: testUser.email,
      password: testUser.password,
    });
    expect(result.user).toBeDefined();
    expect(result.user).not.toHaveProperty("passwordHash");
    expect(result.token).toMatch(/^ses_[A-Za-z0-9_-]{43}$/);
  });

  it("should reject login with wrong password", async () => {
    await expect(
      authService.login({
        email: testUser.email,
        password: "WrongPassword999",
      })
    ).rejects.toThrow("Invalid email or password");
  });

  it("should reject login for non-existent user", async () => {
    await expect(
      authService.login({
        email: "nonexistent@nexus.test",
        password: "password123",
      })
    ).rejects.toThrow("Invalid email or password");
  });

  it("should invalidate session upon logout", async () => {
    const { token } = await authService.login({
      email: testUser.email,
      password: testUser.password,
    });

    await authService.logout(token);
    const session = await authService.getSession(token);
    expect(session).toBeNull();
  });
});
