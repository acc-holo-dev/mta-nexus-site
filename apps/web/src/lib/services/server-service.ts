import { serverRepository, organizationRepository } from "@nexus/db";
import { generateId, can } from "@nexus/security";
import { AppError, ForbiddenError, eventBus } from "@nexus/domain";
import type { Server, User } from "@nexus/domain";
import { isUniqueConstraintViolation } from "../postgres-error";

function throwServerMutationConflict(error: unknown): never {
  if (isUniqueConstraintViolation(error, ["servers_slug_idx", "servers_slug_unique"])) {
    throw new AppError("Server slug is already in use", 409, "SERVER_SLUG_TAKEN");
  }
  if (isUniqueConstraintViolation(error, ["servers_endpoint_idx"])) {
    throw new AppError(
      "This server endpoint is already registered",
      409,
      "SERVER_ENDPOINT_TAKEN",
    );
  }
  throw error;
}


type ServerDetailsUpdate = Partial<
  Pick<
    Server,
    "name" | "description" | "websiteUrl" | "discordUrl" | "rulesUrl" | "mediaUrls" | "language" | "region" | "gameplayTags" | "ipAddress" | "port" | "httpPort" | "gameMode" | "mapName" | "maxPlayers" | "visibility"
  >
>;

class ServerService {
  async listServers(limit = 100): Promise<Server[]> {
    return serverRepository.listActivePublic(limit);
  }

  async searchServers(query: string, limit = 24): Promise<Server[]> {
    return serverRepository.searchActivePublic(query, limit);
  }

  async getServerBySlug(slug: string): Promise<Server | null> {
    return serverRepository.findBySlug(slug);
  }

  async getServerById(id: string): Promise<Server | null> {
    return serverRepository.findById(id);
  }

  async createServer(
    input: Omit<Server, "id" | "status" | "currentPlayers" | "isVerified" | "createdAt" | "updatedAt">,
    actor: User
  ): Promise<Server> {
    if (!can(actor, "server.create")) throw new ForbiddenError("Not authorized to create server");

    // Organization authority is checked under row locks by createWithAudit.
    // Do not perform an authorization read outside its database transaction.

    const id = generateId("srv");
    let server: Server;
    try {
      server = await serverRepository.createWithAudit(
        {
          ...input,
          // Ownership is derived from the authenticated actor, never a
          // caller-supplied ownerId. Organization listings have no personal owner.
          ownerId: input.organizationId ? undefined : actor.id,
          id,
          // Editorial status is independent from the official MTA network status.
          status: "active",
          isVerified: false,
        },
        {
          id: generateId("aud"),
          actorId: actor.id,
          actorType: "user",
          action: "server.created",
          targetId: id,
          targetType: "server",
          details: { name: input.name, ip: input.ipAddress, port: input.port },
        },
        actor.role,
      );
    } catch (error) {
      throwServerMutationConflict(error);
    }

    // The server and audit are committed. Best-effort event subscribers
    // cannot turn a successful creation into a client-visible 500/retry.
    try {
      await eventBus.publish({
        id: generateId("evt"),
        type: "server.created",
        version: 1,
        timestamp: new Date().toISOString(),
        actor: { id: actor.id, type: "user" },
        aggregateId: id,
        aggregateType: "server",
        payload: {
          serverId: id,
          name: server.name,
          ownerId: server.ownerId,
          organizationId: server.organizationId,
          ip: server.ipAddress,
          port: server.port,
        },
      });
    } catch {
      // Do not log event payloads, addresses or subscriber error details.
      console.error("Nexus committed write succeeded but event dispatch failed", {
        eventType: "server.created",
        aggregateType: "server",
        aggregateId: id,
      });
    }

    return server;
  }

  async canManageServer(server: Server, actor: User): Promise<boolean> {
    if (can(actor, "server.manage", server)) return true;
    if (!server.organizationId) return false;

    const [organization, organizationMemberships] = await Promise.all([
      organizationRepository.findById(server.organizationId),
      organizationRepository.listUserMemberships(actor.id),
    ]);

    if (organization?.ownerId === actor.id) return true;

    return can(actor, "server.manage", server, {
      organizationMemberships,
    });
  }

  async updateServer(
    serverId: string,
    updates: ServerDetailsUpdate,
    actor: User,
    expectedUpdatedAt?: Date,
  ): Promise<Server> {
    try {
      return await serverRepository.updateManagedWithAudit(
        serverId,
        updates,
        {
          id: generateId("aud"),
          actorId: actor.id,
          actorType: "user",
          action: "server.updated",
          targetId: serverId,
          targetType: "server",
          details: { fields: Object.keys(updates) },
        },
        actor,
        expectedUpdatedAt,
      );
    } catch (error) {
      throwServerMutationConflict(error);
    }
  }

}

export const serverService = new ServerService();
