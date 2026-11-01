/** Client-safe MTA master-list types and helpers (no server/config imports). */

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
