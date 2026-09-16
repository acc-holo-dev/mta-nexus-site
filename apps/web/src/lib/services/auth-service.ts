import {
  userRepository,
  sessionRepository,
  organizationRepository,
  auditRepository,
} from "@nexus/db";
import { generateId, hashPassword, verifyPassword } from "@nexus/security";
import {
  NotFoundError,
  UnauthorizedError,
  ConflictError,
  ForbiddenError,
} from "@nexus/domain";
import type { User } from "@nexus/domain";

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

    const user = await userRepository.create({
      id: userId,
      email: input.email.toLowerCase(),
      username: input.username,
      displayName: input.displayName || input.username,
      passwordHash,
      role: "user",
      isVerified: false,
      emailVerified: false,
    });

    const token = generateId("ses");
    const expiresAt = new Date(Date.now() + 86400000 * 14); // 14 days

    await sessionRepository.create({
      id: generateId("ses"),
      userId: user.id,
      token,
      expiresAt,
    });

    await auditRepository.record({
      id: generateId("aud"),
      actorId: user.id,
      actorType: "user",
      action: "user.registered",
      targetId: user.id,
      targetType: "user",
      details: { email: user.email },
    });

    return { user, token };
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

    const token = generateId("ses");
    const expiresAt = new Date(Date.now() + 86400000 * 14);

    await sessionRepository.create({
      id: generateId("ses"),
      userId: userWithHash.id,
      token,
      expiresAt,
    });

    await auditRepository.record({
      id: generateId("aud"),
      actorId: userWithHash.id,
      actorType: "user",
      action: "user.logged_in",
      targetId: userWithHash.id,
      targetType: "user",
      details: { email: userWithHash.email },
    });

    // Strip passwordHash from returned DTO
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
    if (session) {
      await auditRepository.record({
        id: generateId("aud"),
        actorId: session.user.id,
        actorType: "user",
        action: "user.logged_out",
        targetId: session.user.id,
        targetType: "user",
      });
    }
    await sessionRepository.delete(token);
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
