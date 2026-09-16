import { serverRepository, auditRepository } from "@nexus/db";
import { generateId, can } from "@nexus/security";
import { NotFoundError, ForbiddenError, eventBus } from "@nexus/domain";
import type { Server, ServerInstallation, User } from "@nexus/domain";

export class ServerService {
  async listServers(): Promise<Server[]> {
    return serverRepository.listActivePublic();
  }

  async getServerBySlug(slug: string): Promise<Server | null> {
    return serverRepository.findBySlug(slug);
  }

  async getServerById(id: string): Promise<Server | null> {
    return serverRepository.findById(id);
  }

  async createServer(
    input: Omit<Server, "id" | "currentPlayers" | "isVerified" | "createdAt" | "updatedAt">,
    actor: User
  ): Promise<Server> {
    if (!can(actor, "server.create")) {
      throw new ForbiddenError("Not authorized to create server");
    }

    const id = generateId("srv");
    const server = await serverRepository.create({
      ...input,
      id,
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
      payload: {
        serverId: id,
        name: server.name,
        ownerId: actor.id,
        ip: server.ipAddress,
        port: server.port,
      },
    });

    return server;
  }

  async registerInstallation(serverId: string, moduleVersion = "1.0.0"): Promise<ServerInstallation> {
    const server = await serverRepository.findById(serverId);
    if (!server) throw new NotFoundError("Server", serverId);

    const instId = generateId("ins");
    const installation = await serverRepository.createInstallation({
      id: instId,
      serverId,
      apiKeyHash: "hash_" + generateId("ses"),
      moduleVersion,
      mtaVersion: "1.6.0",
      os: "linux",
      status: "active",
      lastHeartbeatAt: new Date(),
      capabilities: ["entitlements_v1", "telemetry_v1", "hot_reload"],
    });

    await auditRepository.record({
      id: generateId("aud"),
      actorId: serverId,
      actorType: "system",
      action: "server.installation_registered",
      targetId: instId,
      targetType: "server_installation",
      details: { moduleVersion },
    });

    await eventBus.publish({
      id: generateId("evt"),
      type: "server.installation.activated",
      version: 1,
      timestamp: new Date().toISOString(),
      actor: { id: serverId, type: "server" },
      aggregateId: instId,
      aggregateType: "server_installation",
      payload: {
        installationId: instId,
        serverId,
        moduleVersion,
      },
    });

    return installation;
  }
}

export const serverService = new ServerService();
