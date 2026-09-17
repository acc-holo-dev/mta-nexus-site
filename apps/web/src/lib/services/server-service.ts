import { serverRepository, auditRepository, telemetryRepository } from "@nexus/db";
import { generateId, can } from "@nexus/security";
import crypto from "node:crypto";
import { NotFoundError, ForbiddenError, eventBus } from "@nexus/domain";
import type { Server, ServerInstallation, User } from "@nexus/domain";

type ServerDetailsUpdate = Partial<
  Pick<
    Server,
    "name" | "description" | "ipAddress" | "port" | "httpPort" | "gameMode" | "mapName" | "maxPlayers" | "visibility"
  >
>;

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
    input: Omit<Server, "id" | "status" | "currentPlayers" | "isVerified" | "createdAt" | "updatedAt">,
    actor: User
  ): Promise<Server> {
    if (!can(actor, "server.create")) throw new ForbiddenError("Not authorized to create server");

    const id = generateId("srv");
    const server = await serverRepository.create({
      ...input,
      id,
      status: "inactive",
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

  async registerInstallation(
    serverId: string,
    actor: User,
    moduleVersion = "0.1.0"
  ): Promise<ServerInstallation & { apiKey?: string }> {
    const server = await serverRepository.findById(serverId);
    if (!server) throw new NotFoundError("Server", serverId);
    if (!can(actor, "server.manage", server)) {
      throw new ForbiddenError("Only the server owner can register an installation");
    }

    const instId = generateId("ins");
    const apiKey = "nxk_" + crypto.randomBytes(24).toString("hex");
    const apiKeyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

    const installation = await serverRepository.replaceActiveInstallation({
      id: instId,
      serverId,
      apiKeyHash,
      moduleVersion,
      mtaVersion: "1.6.0",
      os: "linux",
      status: "active",
      lastHeartbeatAt: new Date(),
      capabilities: ["telemetry_v1"],
    });

    await auditRepository.record({
      id: generateId("aud"),
      actorId: actor.id,
      actorType: "user",
      action: "server.installation_registered",
      targetId: instId,
      targetType: "server_installation",
      details: { moduleVersion, replacesPreviousKey: true },
    });

    await eventBus.publish({
      id: generateId("evt"),
      type: "server.installation.activated",
      version: 1,
      timestamp: new Date().toISOString(),
      actor: { id: actor.id, type: "user" },
      aggregateId: instId,
      aggregateType: "server_installation",
      payload: { installationId: instId, serverId, moduleVersion },
    });

    return { ...installation, apiKey };
  }

  async getServerTelemetry(serverId: string) {
    const server = await serverRepository.findById(serverId);
    if (!server) throw new NotFoundError("Server", serverId);

    const heartbeats = await telemetryRepository.listRecentHeartbeats(serverId, 24);
    const peakPlayers = await telemetryRepository.getPeakPlayers(serverId, 24);

    return {
      serverId,
      currentStatus: server.status,
      currentPlayers: server.currentPlayers,
      maxPlayers: server.maxPlayers,
      peakPlayers24h: peakPlayers,
      recentHeartbeats: heartbeats.length,
      lastHeartbeatAt: heartbeats[0]?.recordedAt || null,
    };
  }
}

export const serverService = new ServerService();
