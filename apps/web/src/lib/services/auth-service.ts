import {
  userRepository,
  sessionRepository,
  organizationRepository,
  authRepository,
} from "@nexus/db";
import { generateId, generateSessionToken, hashPassword, verifyPassword } from "@nexus/security";
import {
  NotFoundError,
  UnauthorizedError,
  ConflictError,
  ForbiddenError,
} from "@nexus/domain";
import type { User } from "@nexus/domain";

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
      return { user, token };
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

    const { passwordHash: _, ...user } = userWithHash;
    return { user: user as User, token };
  }

  async getSession(token?: string | null): Promise<User | null> {
    if (!token) return null;
    const result = await sessionRepository.findValidSession(token);
    return result ? result.user : null;
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
    return updated;
  }

  async getUserById(id: string): Promise<User | null> {
    return userRepository.findById(id);
  }

  async listUsers(): Promise<User[]> {
    return userRepository.listAll();
  }
}

export const authService = new AuthService();
