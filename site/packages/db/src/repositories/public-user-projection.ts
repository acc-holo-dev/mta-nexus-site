import { getTableColumns } from "drizzle-orm";
import type { User } from "@nexus/domain";
import { users } from "../schema";

type StoredUser = typeof users.$inferSelect;
type UserWithoutPassword = Omit<StoredUser, "passwordHash"> & {
  passwordHash?: StoredUser["passwordHash"];
};

// Reuse the schema's typed columns without reading credentials for account/profile work.
const { passwordHash: _passwordHash, ...columns } = getTableColumns(users);
export const publicUserColumns = columns;

export function toUserWithoutPassword(row: UserWithoutPassword): User {
  // Keep a defensive boundary for adapters/fixtures that return extra fields.
  const { passwordHash: _passwordHash, ...user } = row;
  return user as unknown as User;
}
