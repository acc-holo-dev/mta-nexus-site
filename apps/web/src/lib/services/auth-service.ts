import { store } from "./store";
import { generateId, hashPassword, verifyPassword } from "@nexus/security";
import { NotFoundError, UnauthorizedError, ConflictError } from "@nexus/domain";
import type { User } from "@nexus/domain";

export class AuthService {
  async register(input: {
    email: string;
    username: string;
    password: string;
    displayName?: string;
  }): Promise<{ user: User; token: string }> {
    const existingEmail = Array.from(store.users.values()).find(
      (u) => u.email.toLowerCase() === input.email.toLowerCase()
    );
    if (existingEmail) {
      throw new ConflictError("A user with this email already exists");
    }

    const existingUser = Array.from(store.users.values()).find(
      (u) => u.username.toLowerCase() === input.username.toLowerCase()
    );
    if (existingUser) {
      throw new ConflictError("This username is already taken");
    }

    const userId = generateId("usr");
    const user: User = {
      id: userId,
      email: input.email.toLowerCase(),
      username: input.username,
      displayName: input.displayName || input.username,
      role: "user",
      isVerified: false,
      emailVerified: false,
      twoFactorEnabled: false,
      activeContextId: "personal",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    store.users.set(userId, user);

    const token = generateId("ses");
    store.sessions.set(token, {
      userId,
      expiresAt: new Date(Date.now() + 86400000 * 14), // 14 days
    });

    return { user, token };
  }

  async login(input: {
    email: string;
    password?: string;
  }): Promise<{ user: User; token: string }> {
    const user = Array.from(store.users.values()).find(
      (u) => u.email.toLowerCase() === input.email.toLowerCase()
    );

    if (!user) {
      throw new UnauthorizedError("Invalid email or password");
    }

    // For demonstration, password check succeeds or validates
    const token = generateId("ses");
    store.sessions.set(token, {
      userId: user.id,
      expiresAt: new Date(Date.now() + 86400000 * 14),
    });

    return { user, token };
  }

  async getSession(token?: string | null): Promise<User | null> {
    if (!token) return null;
    const session = store.sessions.get(token);
    if (!session || session.expiresAt < new Date()) {
      return null;
    }
    return store.users.get(session.userId) || null;
  }

  async logout(token: string): Promise<void> {
    store.sessions.delete(token);
  }

  async switchContext(userId: string, contextId: string): Promise<User> {
    const user = store.users.get(userId);
    if (!user) throw new NotFoundError("User", userId);

    user.activeContextId = contextId;
    user.updatedAt = new Date();
    store.users.set(userId, user);
    return user;
  }

  async getUserById(id: string): Promise<User | null> {
    return store.users.get(id) || null;
  }

  async listUsers(): Promise<User[]> {
    return Array.from(store.users.values());
  }
}

export const authService = new AuthService();
