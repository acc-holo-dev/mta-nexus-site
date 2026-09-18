import { serverRepository, auditRepository, organizationRepository } from "@nexus/db";
import { generateId, can } from "@nexus/security";
import { NotFoundError, ForbiddenError, eventBus } from "@nexus/domain";
import type { Server, User } from "@nexus/domain";

type ServerDetailsUpdate = Partial<
  Pick<
    Server,
    "name" | "description" | "ipAddress" | "port" | "httpPort" | "gameMode" | "mapName" | "maxPlayers" | "visibility"
  >
>;

export class ServerService {
  async listServers(limit = 100): Promise<Server[]> {
    return serverRepository.listActivePublic(limit);
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

    if (input.organizationId) {
      const organization = await organizationRepository.findById(input.organizationId);
      if (!organization) throw new NotFoundError("Organization", input.organizationId);

      const memberships = await organizationRepository.listUserMemberships(actor.id);
      const membership = memberships.find((item) => item.organizationId === input.organizationId);
      const canManageOrganization =
        organization.ownerId === actor.id ||
        membership?.role === "owner" ||
        membership?.role === "admin" ||
        membership?.role === "developer";

      if (!canManageOrganization) {
        throw new ForbiddenError("You do not manage this organization");
      }
    }

    const id = generateId("srv");
    const server = await serverRepository.create({
      ...input,
      id,
      // A listing is editorially active immediately; live availability is sourced separately from the official MTA directory.
      status: "active",
      currentPlayers: 0,
      isVerified: false,
    });

    await auditRepository.record({
      id: generateId("aud"),
      actorId: actor.id,
      actorType: "user",
      action: "server.created",
      targetId: id,
      targetType: "server",
      details: { name: server.name, ip: server.ipAddress, port: server.port },
    });

    await eventBus.publish({
      id: generateId("evt"),
      type: "server.created",
      version: 1,
      timestamp: new Date().toISOString(),
      actor: { id: actor.id, type: "user" },
      aggregateId: id,
      aggregateType: "server",
      payload: { serverId: id, name: server.name, ownerId: actor.id, ip: server.ipAddress, port: server.port },
    });

    return server;
  }

  async updateServer(serverId: string, updates: ServerDetailsUpdate, actor: User): Promise<Server> {
    const server = await serverRepository.findById(serverId);
    if (!server) throw new NotFoundError("Server", serverId);
    if (!can(actor, "server.manage", server)) {
      throw new ForbiddenError("Only the server owner can update its details");
    }

    const updated = await serverRepository.update(serverId, updates);
    if (!updated) throw new NotFoundError("Server", serverId);

    await auditRepository.record({
      id: generateId("aud"),
      actorId: actor.id,
      actorType: "user",
      action: "server.updated",
      targetId: serverId,
      targetType: "server",
      details: { fields: Object.keys(updates) },
    });

    return updated;
  }

}

export const serverService = new ServerService();
