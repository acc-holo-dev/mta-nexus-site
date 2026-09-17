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
      }
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

  async listSessions(userId: string) {
    return sessionRepository.listByUser(userId);
  }

  async revokeSession(userId: string, sessionId: string): Promise<boolean> {
    const revoked = await sessionRepository.deleteById(sessionId, userId);
    if (revoked) {
      await auditRepository.record({
        id: generateId("aud"),
        actorId: userId,
        actorType: "user",
        action: "user.session_revoked",
        targetId: userId,
        targetType: "user",
        details: { sessionId },
      });
    }
    return revoked;
  }

  async revokeOtherSessions(userId: string, currentToken: string): Promise<number> {
    const revokedCount = await sessionRepository.deleteOtherSessions(userId, currentToken);
    if (revokedCount > 0) {
      await auditRepository.record({
        id: generateId("aud"),
        actorId: userId,
        actorType: "user",
        action: "user.other_sessions_revoked",
        targetId: userId,
        targetType: "user",
        details: { revokedCount },
      });
    }
    return revokedCount;
  }

  async switchContext(userId: string, contextId: string): Promise<User> {
    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError("User", userId);

    if (contextId !== "personal") {
      const memberships = await organizationRepository.listUserMemberships(userId);
      const isMember = memberships.some((m) => m.organizationId === contextId);
      if (!isMember) {
        throw new ForbiddenError("Not authorized to switch to this organization context");
      }
    }

    const updated = await userRepository.update(userId, { activeContextId: contextId });
    if (!updated) throw new NotFoundError("User", userId);
    return toPublicUser(updated);
  }

  async getUserById(id: string): Promise<User | null> {
    const user = await userRepository.findById(id);
    return user ? toPublicUser(user) : null;
  }

  async listUsers(): Promise<User[]> {
    const users = await userRepository.listAll();
    return users.map((user) => toPublicUser(user));
  }
}

export const authService = new AuthService();
