const MTA_MASTER_URL = "https://master.multitheftauto.com/ase/mta/";
const CACHE_TTL_MS = 60_000;
const STALE_CACHE_TTL_MS = 15 * 60_000;
const MAX_MASTER_PAYLOAD_BYTES = 8 * 1024 * 1024;
const MAX_MASTER_SERVERS = 10_000;

const FLAG = {
  players: 0x0004,
  maxPlayers: 0x0008,
  gameName: 0x0010,
  name: 0x0020,
  gameMode: 0x0040,
  mapName: 0x0080,
  version: 0x0100,
  passworded: 0x0200,
  serials: 0x0400,
  playerList: 0x0800,
  responding: 0x1000,
  restrictions: 0x2000,
  searchIgnoreSections: 0x4000,
  keep: 0x8000,
  httpPort: 0x080000,
  special: 0x100000,
} as const;

export type MtaMasterServer = {
  address: string;
  port: number;
  httpPort?: number;
  name?: string;
  gameName?: string;
  gameMode?: string;
  mapName?: string;
  version?: string;
  players?: number;
  maxPlayers?: number;
  passworded?: boolean;
  responding?: boolean;
};

export function normalizeMtaAddress(address: string): string {
  return address.trim().toLowerCase().replace(/\.$/, "");
}

export function matchesMtaEndpoint(
  editorial: { ipAddress: string; port: number },
  observation: Pick<MtaMasterServer, "address" | "port">
): boolean {
  return (
    editorial.port === observation.port &&
    normalizeMtaAddress(editorial.ipAddress) === normalizeMtaAddress(observation.address)
  );
}

export type MtaMasterDirectory = {
  servers: MtaMasterServer[];
  fetchedAt: string;
  isStale: boolean;
};

let cachedDirectory: MtaMasterDirectory | null = null;
let cacheExpiresAt = 0;
let staleCacheExpiresAt = 0;
let pendingDirectory: Promise<MtaMasterDirectory> | null = null;

class MasterListReader {
  private offset = 0;
  private readonly view: DataView;

  constructor(private readonly data: ArrayBuffer) {
    this.view = new DataView(data);
  }

  get remaining() {
    return this.data.byteLength - this.offset;
  }

  get position() {
    return this.offset;
  }

  seek(position: number) {
    if (position < this.offset || position > this.data.byteLength) {
      throw new Error("Invalid MTA master-list entry boundary");
    }
    this.offset = position;
  }

  u8() {
    this.ensure(1);
    return this.view.getUint8(this.offset++);
  }

  u16() {
    this.ensure(2);
    const value = this.view.getUint16(this.offset, false);
    this.offset += 2;
    return value;
  }

  u32() {
    this.ensure(4);
    const value = this.view.getUint32(this.offset, false);
    this.offset += 4;
    return value;
  }

  ipv4() {
    return [this.u8(), this.u8(), this.u8(), this.u8()].join(".");
  }

  string() {
    const length = this.u8();
    this.ensure(length);
    const bytes = new Uint8Array(this.data, this.offset, length);
    this.offset += length;
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  }

  private ensure(length: number) {
    if (this.offset + length > this.data.byteLength) {
      throw new Error("Truncated MTA master-list payload");
    }
  }
}

export function parseMtaMasterList(data: ArrayBuffer): MtaMasterServer[] {
  const reader = new MasterListReader(data);
  if (reader.remaining < 16 || reader.u16() !== 0 || reader.u16() !== 2) {
    throw new Error("Unsupported MTA master-list format");
  }

  const flags = reader.u32();
  reader.u32(); // sequence number
  const count = reader.u32();
  if (count > MAX_MASTER_SERVERS) {
    throw new Error("MTA master-list server count exceeds safety limit");
  }
  const servers: MtaMasterServer[] = [];

  for (let index = 0; index < count; index++) {
    if (reader.remaining < 2) {
      throw new Error("Truncated MTA master-list server entry");
    }
    const entryStart = reader.position;
    const entryLength = reader.u16();
    const entryEnd = entryStart + entryLength;
    if (entryLength < 8 || entryEnd > data.byteLength) {
      throw new Error("Invalid MTA master-list entry length");
    }

    const server: MtaMasterServer = { address: reader.ipv4(), port: reader.u16() };
    if (flags & FLAG.players) server.players = reader.u16();
    if (flags & FLAG.maxPlayers) server.maxPlayers = reader.u16();
    if (flags & FLAG.gameName) server.gameName = reader.string();
    if (flags & FLAG.name) server.name = reader.string();
    if (flags & FLAG.gameMode) server.gameMode = reader.string();
    if (flags & FLAG.mapName) server.mapName = reader.string();
    if (flags & FLAG.version) server.version = reader.string();
    if (flags & FLAG.passworded) server.passworded = reader.u8() !== 0;
    if (flags & FLAG.serials) reader.u8();

    if (flags & FLAG.playerList) {
      const playerCount = reader.u16();
      for (let player = 0; player < playerCount; player++) reader.string();
    }

    if (flags & FLAG.responding) server.responding = reader.u8() === 0;
    if (flags & FLAG.restrictions) reader.u32();

    if (flags & FLAG.searchIgnoreSections) {
      const sectionCount = reader.u8();
      for (let section = 0; section < sectionCount; section++) {
        reader.u8();
        reader.u8();
      }
    }

    if (flags & FLAG.keep) reader.u8();
    if (flags & FLAG.httpPort) server.httpPort = reader.u16();
    if (flags & FLAG.special) reader.u8();

    reader.seek(entryEnd);
    servers.push(server);
  }

  return servers;
}

async function requestDirectory(): Promise<MtaMasterDirectory> {
  const response = await fetch(MTA_MASTER_URL, {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
    headers: { "user-agent": "MTA-Nexus/1.0 (+https://nexus-mta.com)" },
  });

  if (!response.ok) {
    throw new Error(`MTA master-list request failed with ${response.status}`);
  }

  const payload = await response.arrayBuffer();
  if (payload.byteLength > MAX_MASTER_PAYLOAD_BYTES) {
    throw new Error("MTA master-list payload exceeds safety limit");
  }

  const servers = parseMtaMasterList(payload)
    .filter((server) => server.responding !== false)
    .sort((a, b) => (b.players ?? 0) - (a.players ?? 0));

  return { servers, fetchedAt: new Date().toISOString(), isStale: false };
}

export const mtaMasterDirectoryService = {
  async getDirectory(): Promise<MtaMasterDirectory> {
    if (cachedDirectory && Date.now() < cacheExpiresAt) return cachedDirectory;

    if (!pendingDirectory) {
      pendingDirectory = requestDirectory()
        .then((directory) => {
          cachedDirectory = directory;
          cacheExpiresAt = Date.now() + CACHE_TTL_MS;
          staleCacheExpiresAt = Date.now() + STALE_CACHE_TTL_MS;
          return directory;
        })
        .catch((error) => {
          if (cachedDirectory && Date.now() < staleCacheExpiresAt) {
            return { ...cachedDirectory, isStale: true };
          }
          throw error;
        })
        .finally(() => {
          pendingDirectory = null;
        });
    }

    return pendingDirectory;
  },
};
