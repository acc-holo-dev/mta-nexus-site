import { sql } from "drizzle-orm";
import type { db } from "../client";
import { reports } from "../schema";

export type Session = Pick<typeof db, "select" | "insert" | "update" | "delete" | "execute">;
export type Scope = { actorId: string; staff: boolean };
export type Status = "open" | "under_review" | "resolved" | "dismissed";
export type BatchInput = {
  items: { id: string; expectedStatus: "open" | "under_review" }[];
  action: "review" | "resolve" | "dismiss";
  notes: string;
};

export const reportListFields = {
  id: reports.id,
  targetType: reports.targetType,
  targetId: reports.targetId,
  type: reports.type,
  reason: sql<string>`left(${reports.reason},1000)`,
  evidenceUrls: reports.evidenceUrls,
  status: reports.status,
  createdAt: reports.createdAt,
  resolvedAt: reports.resolvedAt,
};
