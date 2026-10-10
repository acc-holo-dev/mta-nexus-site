import type { NextRequest } from "next/server";
import { supportActivityRepository } from "@nexus/db";
import { AppError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import { userPlatformApi } from "../../../../../lib/user-platform-api";
import { supportWorkspaceError } from "../../../../../lib/support-workspace-copy";
import { supportActivitySchema } from "../../../../../lib/support-workspace-contract";
export function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return userPlatformApi(
    request,
    async (user) => {
      const { id } = await context.params;
      if (!/^sup_[a-f0-9]{24}$/u.test(id)) throw new AppError("Not found", 404, "NOT_FOUND");
      const params = request.nextUrl.searchParams;
      for (const [key] of params)
        if (key !== "before" || params.getAll(key).length !== 1)
          throw new AppError("Invalid cursor", 400, "VALIDATION_ERROR");
      const before = params.get("before") ?? undefined;
      if (before !== undefined && !/^[a-zA-Z0-9_-]{1,128}$/u.test(before))
        throw new AppError("Invalid cursor", 400, "VALIDATION_ERROR");
      if (!(await consumeRateLimit("search", user.id)).success) throw new RateLimitExceededError();
      const result = await supportActivityRepository.history(id, user.id, before);
      return supportActivitySchema.parse({
        ...result,
        items: result.items.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
      });
    },
    200,
    supportWorkspaceError,
  );
}
