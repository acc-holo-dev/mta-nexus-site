import { auditRepository } from "@nexus/db";
import { AppError } from "@nexus/domain";
import {
  type parseServerWorkspaceHistoryQuery,
  serverWorkspaceHistorySchema,
} from "../server-workspace-contract";
export const serverWorkspaceHistoryService = {
  async page(
    actorId: string,
    serverId: string,
    filters: NonNullable<ReturnType<typeof parseServerWorkspaceHistoryQuery>>,
  ) {
    const result = await auditRepository.managedServerHistory(serverId, actorId, filters);
    const events = result.events.map((row) => {
      const actor =
        row.actorType === "admin"
          ? "moderation"
          : row.actorType !== "user"
            ? "system"
            : row.actorId === actorId
              ? "you"
              : "team";
      const identity =
        (actor === "team" || actor === "moderation") &&
        row.actorUsername &&
        /^[A-Za-z0-9_-]{1,64}$/u.test(row.actorUsername)
          ? { username: row.actorUsername, name: row.actorDisplayName || row.actorUsername }
          : null;
      const transition =
        row.action === "server.updated" &&
        row.fields.includes("visibility") &&
        row.fromVisibility &&
        row.toVisibility
          ? { before: row.fromVisibility, after: row.toVisibility }
          : null;
      return {
        id: row.id,
        action: row.action,
        actor,
        identity,
        fields: row.fields,
        createdAt: row.createdAt,
        transition,
      };
    });
    const value = {
      server: result.server,
      until: result.until,
      period: result.period,
      action: result.action,
      events,
      nextCursor: result.nextCursor
        ? Buffer.from(JSON.stringify(result.nextCursor)).toString("base64url")
        : null,
    };
    const parsed = serverWorkspaceHistorySchema.safeParse(value);
    if (!parsed.success) throw new AppError("Server history unavailable", 503, "INTERNAL_ERROR");
    return parsed.data;
  },
};
