import type { db } from "./client";

export type ResourceTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
