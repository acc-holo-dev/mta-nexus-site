import { readMtaMasterMirrorUrls } from "@nexus/config";
import { normalizeMtaAddress } from "@nexus/domain";
export { normalizeMtaAddress } from "@nexus/domain";
import { MTA_MASTER_FRESH_TTL_MS } from "../mta-directory-cache";

const MTA_MASTER_URL = "https://master.multitheftauto.com/ase/mta/";
const MASTER_TOTAL_TIMEOUT_MS = 10_000;
const MASTER_ENDPOINT_TIMEOUT_MS = 4_000;
const CACHE_TTL_MS = MTA_MASTER_FRESH_TTL_MS;
const STALE_CACHE_TTL_MS = 15 * 60_000;
const MAX_MASTER_PAYLOAD_BYTES = 8 * 1024 * 1024;
const MAX_MASTER_SERVERS = 10_000;
const MASTER_LIST_EOF_MARKER = 0x12345679;

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

export function mtaLiveStatus(
  observation: Pick<MtaMasterServer, "responding"> | null | undefined,
  isStale = false,
): "online" | "offline" | "unknown" {
  if (isStale || !observation) return "unknown";
  return observation.responding === false ? "offline" : "online";
}

export function matchesMtaEndpoint(
  editorial: { ipAddress: string; port: number },
  observation: Pick<MtaMasterServer, "address" | "port">,
): boolean {
  return (
    editorial.port === observation.port &&
    normalizeMtaAddress(editorial.ipAddress) === normalizeMtaAddress(observation.address)
  );
}

export function indexMtaObservations(servers: readonly MtaMasterServer[]) {
  const byEndpoint = new Map<string, MtaMasterServer>();
  let nextIndex = 0;
  return (editorial: { ipAddress: string; port: number }) => {
    const key = `${normalizeMtaAddress(editorial.ipAddress)}:${editorial.port}`;
    const known = byEndpoint.get(key);
    if (known) return known;

    // Index only the visited prefix of this snapshot; never scan it twice.
    while (nextIndex < servers.length) {
      const server = servers[nextIndex++];
      const observedKey = `${normalizeMtaAddress(server.address)}:${server.port}`;
      if (!byEndpoint.has(observedKey)) byEndpoint.set(observedKey, server);
      if (observedKey === key) return server;
    }
    return undefined;
  };
}

export type MtaMasterDirectory = {
  servers: MtaMasterServer[];
  fetchedAt: string;
  isStale: boolean;
};

let cachedDirectory: MtaMasterDirectory | null = null;
let cacheExpiresAt = 0;
let staleCacheExpiresAt = 0;
// When the upstream is down and no successful snapshot exists, remember the
// failure for a short window so visitors do not each wait for the full request
// timeout before seeing the graceful "directory unavailable" state.
let failureBackoffUntil = 0;
let pendingDirectory: Promise<MtaMasterDirectory> | null = null;

class MasterListReader {
  private offset = 0;
  private entryEnd: number | null = null;
  private readonly view: DataView;
  private readonly decoder = new TextDecoder("utf-8", { fatal: false });

  constructor(private readonly data: ArrayBuffer) {
    this.view = new DataView(data);
  }

  get remaining() {
    return this.data.byteLength - this.offset;
  }

  get position() {
    return this.offset;
  }

  startEntry(end: number) {
    if (this.entryEnd !== null || end < this.offset || end > this.data.byteLength) {
      throw new Error("Invalid MTA master-list entry boundary");
    }
    this.entryEnd = end;
  }

  seek(position: number) {
    if (
      position < this.offset ||
      position > this.data.byteLength ||
      (this.entryEnd !== null && position > this.entryEnd)
    ) {
      throw new Error("Invalid MTA master-list entry boundary");
    }
    this.offset = position;
    if (this.entryEnd === position) this.entryEnd = null;
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
    return this.decoder.decode(bytes);
  }

  skipString() {
    // The master packet may include thousands of player names, but NEXUS
    // does not expose them. Validate the length without decoding or
    // allocating a Uint8Array for every ignored field.
    const length = this.u8();
    this.ensure(length);
    this.offset += length;
  }

  private ensure(length: number) {
    if (this.entryEnd !== null && this.offset + length > this.entryEnd) {
      throw new Error("Truncated MTA master-list entry");
    }
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
    // Validate each read against this entry, not merely the entire packet.
    // Malformed strings must not decode bytes from the next server or EOF.
    reader.startEntry(entryEnd);

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
      for (let player = 0; player < playerCount; player++) reader.skipString();
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

  // The official MTA client validates this marker before using a version 2
  // list. Without it, a truncated final entry can look like a valid snapshot.
  if (reader.remaining !== 4 || reader.u32() !== MASTER_LIST_EOF_MARKER) {
    throw new Error("Invalid MTA master-list EOF marker");
  }

  return servers;
}

export async function readBoundedMasterPayload(
  response: Response,
  maxBytes = MAX_MASTER_PAYLOAD_BYTES,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > MAX_MASTER_PAYLOAD_BYTES) {
    throw new Error("Invalid MTA master-list payload size limit");
  }
  if (signal?.aborted) {
    void response.body?.cancel().catch(() => {});
    signal.throwIfAborted();
  }
  const declaredLength = response.headers.get("content-length");
  if (
    declaredLength !== null &&
    (!/^[0-9]+$/u.test(declaredLength) ||
      !Number.isSafeInteger(Number(declaredLength)) ||
      Number(declaredLength) > maxBytes)
  ) {
    // A faulty mirror may never settle its stream's cancel() promise.
    // Reject immediately rather than blocking the next healthy mirror.
    void response.body?.cancel().catch(() => {});
    throw new Error("MTA master-list payload exceeds safety limit");
  }
  if (!response.body) throw new Error("MTA master-list response has no body");

  const reader = response.body.getReader();
  const cancel = () => {
    void reader.cancel().catch(() => {});
  };
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) cancel();
  // Keep bounded byte storage rather than one retained object per HTTP chunk.
  let bytes = new Uint8Array(Math.min(maxBytes, 64 * 1024));
  let total = 0;
  try {
    while (true) {
      signal?.throwIfAborted();
      const { done, value } = await reader.read();
      signal?.throwIfAborted();
      if (done) break;
      if (value.byteLength > maxBytes - total) {
        throw new Error("MTA master-list payload exceeds safety limit");
      }
      const needed = total + value.byteLength;
      if (needed > bytes.byteLength) {
        const expanded = new Uint8Array(Math.min(maxBytes, Math.max(needed, bytes.byteLength * 2)));
        expanded.set(bytes.subarray(0, total));
        bytes = expanded;
      }
      bytes.set(value, total);
      total = needed;
    }
    signal?.throwIfAborted();
  } catch (error) {
    cancel();
    throw error;
  } finally {
    signal?.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
  // The returned ArrayBuffer must exclude unused capacity.
  return bytes.slice(0, total).buffer;
}

type MasterFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export async function requestMtaMasterDirectoryFromEndpoints(
  endpoints: readonly string[],
  fetcher: MasterFetch = fetch,
): Promise<MtaMasterDirectory> {
  if (endpoints.length === 0) {
    throw new Error("No MTA master-list endpoints configured");
  }

  const deadline = Date.now() + MASTER_TOTAL_TIMEOUT_MS;
  for (const endpoint of endpoints) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) break;

    try {
      const endpointSignal = AbortSignal.timeout(Math.min(MASTER_ENDPOINT_TIMEOUT_MS, remainingMs));
      const response = await fetcher(endpoint, {
        cache: "no-store",
        // Do not redirect operator-approved HTTPS endpoints to another host
        // or scheme, particularly to a private/local network address.
        redirect: "error",
        signal: endpointSignal,
        headers: {
          "user-agent": "MTA-Nexus/1.0 (+https://nexus-mta.com)",
        },
      });

      // An injected fetch adapter may ignore redirect: "error".
      // Reject successful but already-redirected responses as well.
      if (!response.ok || response.redirected) {
        void response.body?.cancel().catch(() => {});
        continue;
      }

      const payload = await readBoundedMasterPayload(
        response,
        MAX_MASTER_PAYLOAD_BYTES,
        endpointSignal,
      );
      const servers = parseMtaMasterList(payload)
        .filter((server) => server.responding !== false)
        .sort((a, b) => (b.players ?? 0) - (a.players ?? 0));

      return {
        servers,
        fetchedAt: new Date().toISOString(),
        isStale: false,
      };
    } catch {
      // A mirror must satisfy the same transport, size and binary-format
      // contract as the official endpoint. Try only the next operator-defined
      // endpoint while the shared deadline remains.
    }
  }

  throw new Error("MTA master-list endpoints are unavailable");
}

function configuredMasterEndpoints(): string[] {
  const endpoints = [MTA_MASTER_URL, ...readMtaMasterMirrorUrls()];
  return endpoints.filter((endpoint, index) => endpoints.indexOf(endpoint) === index);
}

async function requestDirectory(): Promise<MtaMasterDirectory> {
  return requestMtaMasterDirectoryFromEndpoints(configuredMasterEndpoints());
}

export const mtaMasterDirectoryService = {
  async getDirectory(): Promise<MtaMasterDirectory> {
    if (cachedDirectory && Date.now() < cacheExpiresAt) return cachedDirectory;
    if (Date.now() < failureBackoffUntil) {
      throw new Error("MTA master-list request is in failure backoff");
    }

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
            cachedDirectory = { ...cachedDirectory, isStale: true };
            // Avoid one upstream request per visitor during an outage, without
            // extending the original 15-minute stale-data deadline.
            cacheExpiresAt = Math.min(Date.now() + 10_000, staleCacheExpiresAt);
            return cachedDirectory;
          }
          // No snapshot to serve: back off briefly so the page degrades fast.
          failureBackoffUntil = Date.now() + 10_000;
          throw error;
        })
        .finally(() => {
          pendingDirectory = null;
        });
    }

    return pendingDirectory;
  },
};
