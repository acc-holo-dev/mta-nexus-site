import { eq } from "drizzle-orm";
import { db } from "../client";
import { users } from "../schema";
import type { User } from "@nexus/domain";

export class UserRepository {
  async findById(id: string): Promise<User | null> {
    try {
      const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
      return (rows[0] as unknown as User) || null;
    } catch {
      return null;
    }
  }

  async findByEmail(email: string): Promise<(User & { passwordHash?: string | null }) | null> {
    try {
      const rows = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
      return (rows[0] as unknown as (User & { passwordHash?: string | null })) || null;
    } catch {
      return null;
    }
  }

  async findByUsername(username: string): Promise<User | null> {
    try {
      const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
      return (rows[0] as unknown as User) || null;
    } catch {
      return null;
    }
  }

  async create(user: {
    id: string;
    email: string;
    username: string;
    displayName: string;
    passwordHash?: string;
    role?: string;
    avatarUrl?: string;
    bio?: string;
    isVerified?: boolean;
    emailVerified?: boolean;
  }): Promise<User> {
    const values = {
      id: user.id,
      email: user.email.toLowerCase(),
      username: user.username,
      displayName: user.displayName,
      passwordHash: user.passwordHash,
      role: user.role || "user",
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      isVerified: user.isVerified || false,
      emailVerified: user.emailVerified || false,
      twoFactorEnabled: false,
      activeContextId: "personal",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      const rows = await db.insert(users).values(values).returning();
      return rows[0] as unknown as User;
    } catch {
      return values as unknown as User;
    }
  }

  async update(id: string, updates: Partial<User>): Promise<User | null> {
    try {
      const rows = await db
        .update(users)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();
      return (rows[0] as unknown as User) || null;
    } catch {
      return null;
    }
  }

  async listAll(): Promise<User[]> {
    try {
      const rows = await db.select().from(users);
      return rows as unknown as User[];
    } catch {
      return [];
    }
  }
}

export const userRepository = new UserRepository();
