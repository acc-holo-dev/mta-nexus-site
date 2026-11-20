import {
  CHANGE_HISTORY_PERIODS,
  PROFILE_CHANGE_ACTIONS,
  PROFILE_CHANGE_FIELDS,
  PROFILE_CHANGE_GROUPS,
} from "@nexus/domain";
import { z } from "zod";
import { changeHistoryTimeSchema, parseChangeHistoryQuery } from "./private-change-history-query";
export const parseProfileChangeHistoryQuery = (params: URLSearchParams) =>
  parseChangeHistoryQuery(params, PROFILE_CHANGE_GROUPS);
export const profileChangeHistorySchema = z
  .object({
    username: z.string().min(1).max(128),
    period: z.enum(CHANGE_HISTORY_PERIODS),
    group: z.enum(PROFILE_CHANGE_GROUPS),
    until: changeHistoryTimeSchema,
    items: z
      .array(
        z
          .object({
            id: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/u),
            action: z.enum(PROFILE_CHANGE_ACTIONS),
            createdAt: changeHistoryTimeSchema,
            fields: z.array(z.enum(PROFILE_CHANGE_FIELDS)).max(8),
            experienceVerificationInvalidated: z.boolean(),
            actor: z.enum(["you", "system"]),
          })
          .strict(),
      )
      .max(20),
    hasMore: z.boolean(),
    nextCursor: z
      .string()
      .max(2048)
      .regex(/^[A-Za-z0-9_-]+$/u)
      .nullable(),
  })
  .strict()
  .refine((value) => value.hasMore === (value.nextCursor !== null));
export type ProfileChangeHistory = z.infer<typeof profileChangeHistorySchema>;
