import { rateLimiter } from "./ratelimit";

export const RATE_LIMIT_POLICIES = {
  authLogin: { limit: 8, windowSeconds: 300 },
  authRegistration: { limit: 5, windowSeconds: 3600 },
  buildUpload: { limit: 10, windowSeconds: 3600 },
  download: { limit: 30, windowSeconds: 60 },
  follow: { limit: 30, windowSeconds: 60 },
  report: { limit: 10, windowSeconds: 3600 },
  sessionManagement: { limit: 20, windowSeconds: 300 },
  passwordChange: { limit: 5, windowSeconds: 3600 },
  notificationMutation: { limit: 30, windowSeconds: 60 },
  resourceClaim: { limit: 20, windowSeconds: 60 },
  verification: { limit: 3, windowSeconds: 86400 },
  moderationAction: { limit: 60, windowSeconds: 60 },
  serverMutation: { limit: 20, windowSeconds: 3600 },
  resourceMutation: { limit: 30, windowSeconds: 3600 },
  contentCreation: { limit: 20, windowSeconds: 3600 },
  commentCreation: { limit: 20, windowSeconds: 300 },
  reviewSubmission: { limit: 5, windowSeconds: 300 },
  search: { limit: 60, windowSeconds: 60 },
} as const;

export type RateLimitPolicy = keyof typeof RATE_LIMIT_POLICIES;

export function getRateLimitPolicy(policy: RateLimitPolicy) {
  return RATE_LIMIT_POLICIES[policy];
}

export function consumeRateLimit(policy: RateLimitPolicy, subject: string) {
  const { limit, windowSeconds } = getRateLimitPolicy(policy);
  return rateLimiter.consume(`${policy}:${subject}`, limit, windowSeconds);
}
