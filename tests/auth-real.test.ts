import { describe, it, expect } from "vitest";
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
    expect(result.token).toBeDefined();

    // Verify session retrieval
    const sessionUser = await authService.getSession(result.token);
    expect(sessionUser).toBeDefined();
    expect(sessionUser?.id).toBe(result.user.id);
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
    expect(result.token).toBeDefined();
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
