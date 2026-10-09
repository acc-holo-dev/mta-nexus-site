import { and, count, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { containsPattern } from "./search-pattern";
import { db } from "../client";
import { users } from "../schema";
import type { User } from "@nexus/domain";
import { publicUserColumns, toUserWithoutPassword } from "./public-user-projection";

export class UserRepository {
  async listModeratorIds(): Promise<string[]> {
    const rows = await db.select({ id: users.id }).from(users).where(
      inArray(users.role, ["moderator", "admin"]),
    );
    return rows.map((row) => row.id);
  }

  async countAll(): Promise<number> {
    const [row] = await db.select({ total: count() }).from(users);
    return row?.total ?? 0;
  }

  async searchDevelopers(term: string, limit = 50): Promise<User[]> {
    const pattern = containsPattern(term);
    const boundedLimit = Number.isFinite(limit)
      ? Math.min(Math.max(Math.floor(limit), 1), 50)
      : 50;
    const rows = await db.select(publicUserColumns).from(users).where(and(
      eq(users.role, "developer"),
      or(ilike(users.username, pattern), ilike(users.displayName, pattern), ilike(users.bio, pattern)),
    )).orderBy(desc(users.updatedAt), desc(users.id)).limit(boundedLimit);
    return rows.map(toUserWithoutPassword);
  }

  async findById(id: string): Promise<User | null> {
    const rows = await db.select(publicUserColumns).from(users).where(eq(users.id, id)).limit(1);
    return rows[0] ? toUserWithoutPassword(rows[0]) : null;
  }

  async findByEmail(email: string): Promise<(User & { passwordHash?: string | null }) | null> {
    const rows = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    return (rows[0] as unknown as (User & { passwordHash?: string | null })) || null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const rows = await db.select(publicUserColumns).from(users).where(eq(users.username, username)).limit(1);
    return rows[0] ? toUserWithoutPassword(rows[0]) : null;
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

    const rows = await db.insert(users).values(values).returning(publicUserColumns);
    return toUserWithoutPassword(rows[0]);
  }

  async update(id: string, updates: Partial<User>): Promise<User | null> {
    const rows = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning(publicUserColumns);
    return rows[0] ? toUserWithoutPassword(rows[0]) : null;
  }

  async updatePassword(id: string, passwordHash: string): Promise<boolean> {
    const rows = await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning({ id: users.id });
    return rows.length > 0;
  }

  async listAll(limit?: number): Promise<User[]> {
    const query = db.select(publicUserColumns).from(users);
    const boundedLimit =
      limit === undefined
        ? undefined
        : Number.isFinite(limit)
          ? Math.min(Math.max(Math.floor(limit), 1), 100)
          : 100;
    const rows = boundedLimit === undefined ? await query : await query.limit(boundedLimit);
    return rows.map(toUserWithoutPassword);
  }

  async listDevelopers(limit = 100): Promise<User[]> {
    const boundedLimit = Number.isFinite(limit)
      ? Math.min(Math.max(Math.floor(limit), 1), 100)
      : 100;
    const rows = await db
      .select(publicUserColumns)
      .from(users)
      .where(or(eq(users.role, "developer"), eq(users.role, "admin")))
      .limit(boundedLimit);
    return rows.map(toUserWithoutPassword);
  }
}

export const userRepository = new UserRepository();
