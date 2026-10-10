import { serverRepository, organizationRepository } from "@nexus/db";
import { generateId, can } from "@nexus/security";
import { NotFoundError, ForbiddenError, eventBus } from "@nexus/domain";
import type { Server, User } from "@nexus/domain";

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
    const server = await serverRepository.createWithAudit(
      {
        ...input,
        id,
        // A listing is editorially active immediately; live availability is sourced separately from the official MTA directory.
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
    );

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

  async updateServer(serverId: string, updates: ServerDetailsUpdate, actor: User): Promise<Server> {
    const server = await serverRepository.findById(serverId);
    if (!server) throw new NotFoundError("Server", serverId);
    if (!(await this.canManageServer(server, actor))) {
      throw new ForbiddenError("You do not manage this server");
    }

    const updated = await serverRepository.updateWithAudit(
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
    );
    if (!updated) throw new NotFoundError("Server", serverId);

    return updated;
  }

}

export const serverService = new ServerService();
