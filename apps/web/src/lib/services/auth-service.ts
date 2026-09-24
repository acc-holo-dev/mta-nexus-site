import {
  userRepository,
  sessionRepository,
  organizationRepository,
  authRepository,
  auditRepository,
} from "@nexus/db";
import { generateId, generateSessionToken, hashPassword, verifyPassword } from "@nexus/security";
import {
  NotFoundError,
  UnauthorizedError,
  ConflictError,
  ForbiddenError,
} from "@nexus/domain";
import type { User } from "@nexus/domain";

function toPublicUser(user: User & { passwordHash?: string | null }): User {
  const { passwordHash: _, ...publicUser } = user;
  return publicUser as User;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

export class AuthService {
  async register(input: {
    email: string;
    username: string;
    password: string;
    displayName?: string;
  }): Promise<{ user: User; token: string }> {
    const existingEmail = await userRepository.findByEmail(input.email);
    if (existingEmail) {
      throw new ConflictError("A user with this email already exists");
    }

    const existingUsername = await userRepository.findByUsername(input.username);
    if (existingUsername) {
      throw new ConflictError("This username is already taken");
    }

    const userId = generateId("usr");
    const passwordHash = await hashPassword(input.password);
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + 86400000 * 14);

    try {
      const user = await authRepository.registerAccount({
        user: {
          id: userId,
          email: input.email,
          username: input.username,
          displayName: input.displayName || input.username,
          passwordHash,
        },
        session: {
          id: generateId("ses"),
          userId,
          token,
          expiresAt,
        },
        audit: {
          id: generateId("aud"),
          actorId: userId,
          actorType: "user",
          action: "user.registered",
          targetId: userId,
          targetType: "user",
          details: { email: input.email.toLowerCase() },
        },
      });
      return { user: toPublicUser(user), token };
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictError("Email or username is already registered");
      }
      throw error;
    }
  }

  async login(input: {
    email: string;
    password: string;
  }): Promise<{ user: User; token: string }> {
    const userWithHash = await userRepository.findByEmail(input.email);
    if (!userWithHash || !userWithHash.passwordHash) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const isMatch = await verifyPassword(input.password, userWithHash.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + 86400000 * 14);

    await authRepository.createLoginSession(
      {
        id: generateId("ses"),
        userId: userWithHash.id,
        token,
        expiresAt,
      },
      {
        id: generateId("aud"),
        actorId: userWithHash.id,
        actorType: "user",
        action: "user.logged_in",
        targetId: userWithHash.id,
        targetType: "user",
        details: { email: userWithHash.email },
      },
      userWithHash.passwordHash
    );

    return { user: toPublicUser(userWithHash), token };
  }

  async getSession(token?: string | null): Promise<User | null> {
    if (!token) return null;
    const result = await sessionRepository.findValidSession(token);
    return result ? toPublicUser(result.user) : null;
  }

  async logout(token: string): Promise<void> {
    const session = await sessionRepository.findValidSession(token);
    if (!session) {
      await sessionRepository.delete(token);
      return;
    }

    await authRepository.revokeSession(token, {
      id: generateId("aud"),
      actorId: session.user.id,
      actorType: "user",
      action: "user.logged_out",
      targetId: session.user.id,
      targetType: "user",
    });
  }

  async changePassword(input: {
    userId: string;
    currentPassword: string;
    newPassword: string;
    currentToken: string;
  }): Promise<{ revokedSessionCount: number; token: string; expiresAt: Date }> {
    const user = await userRepository.findById(input.userId);
    if (!user) throw new NotFoundError("User", input.userId);

    const stored = await userRepository.findByEmail(user.email);
    if (!stored?.passwordHash || !(await verifyPassword(input.currentPassword, stored.passwordHash))) {
      throw new UnauthorizedError("Current password is incorrect");
    }

    const passwordHash = await hashPassword(input.newPassword);
    const token = generateSessionToken();
    const changed = await authRepository.changePassword({
      userId: input.userId,
      expectedPasswordHash: stored.passwordHash,
      passwordHash,
      currentToken: input.currentToken,
      nextToken: token,
      audit: {
        id: generateId("aud"),
        actorId: input.userId,
        actorType: "user",
        action: "user.password_changed",
        targetId: input.userId,
        targetType: "user",
      },
    });
    return { ...changed, token };
  }

  async getCurrentSessionId(token?: string | null): Promise<string | null> {
    if (!token) return null;
    const current = await sessionRepository.findValidSession(token);
    return current?.session.id ?? null;
  }

  async listSessions(userId: string) {
    return sessionRepository.listByUser(userId);
  }

  async revokeSession(userId: string, sessionId: string, currentToken: string): Promise<boolean> {
    return authRepository.revokeOwnedSession({
      userId, sessionId, currentToken, auditId: generateId("aud"),
    });
  }

  async revokeOtherSessions(userId: string, currentToken: string): Promise<number> {
    return authRepository.revokeOtherSessions({
      userId, currentToken, auditId: generateId("aud"),
    });
  }

  async switchContext(userId: string, contextId: string): Promise<User> {
    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError("User", userId);

    const nextContextId = contextId.trim();
    if (!nextContextId) {
      throw new ForbiddenError("A context is required");
    }

    if (nextContextId !== "personal") {
      const memberships = await organizationRepository.listUserMemberships(userId);
      const isMember = memberships.some((m) => m.organizationId === nextContextId);
      if (!isMember) {
        throw new ForbiddenError("Not authorized to switch to this organization context");
      }
    }

    const previousContextId = user.activeContextId ?? "personal";
    const updated = await userRepository.update(userId, { activeContextId: nextContextId });
    if (!updated) throw new NotFoundError("User", userId);

    if (previousContextId !== nextContextId) {
      await auditRepository.record({
        id: generateId("aud"),
        actorId: userId,
        actorType: "user",
        action: "user.context_switched",
        targetId: userId,
        targetType: "user",
        details: { from: previousContextId, to: nextContextId },
      });
    }

    return toPublicUser(updated);
  }

  async getUserById(id: string): Promise<User | null> {
    const user = await userRepository.findById(id);
    return user ? toPublicUser(user) : null;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const user = await userRepository.findByUsername(username);
    return user ? toPublicUser(user) : null;
  }

  async listDevelopers(limit = 100): Promise<User[]> {
    const users = await userRepository.listDevelopers(limit);
    return users.map((user) => toPublicUser(user));
  }

  async listUsers(): Promise<User[]> {
    const users = await userRepository.listAll();
    return users.map((user) => toPublicUser(user));
  }
}

export const authService = new AuthService();
