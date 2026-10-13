import { createHash } from "node:crypto";
import { replayTimestamp } from "../src/lib/services/discussion-replay-checkpoint";

export function discussionReplayOptions(args: string[]) {
  const [checkpointName, fromInput, untilInput, ...rest] = args;
  if (!checkpointName || !fromInput || !untilInput) throw Error("Invalid replay arguments");
  const from = replayTimestamp(fromInput),
    until = replayTimestamp(untilInput);
  if (from > until) throw Error("Invalid replay window");
  const budget = rest[0] && !rest[0].startsWith("--") ? rest.shift() : "100";
  if (!budget || !/^\d{1,5}$/.test(budget)) throw Error("Invalid replay budget");
  const limit = Number(budget);
  if (limit < 1 || limit > 10000) throw Error("Invalid replay budget");
  if (
    new Set(rest).size !== rest.length ||
    rest.some((flag) => !["--worker", "--adopt-legacy", "--repair-push"].includes(flag))
  )
    throw Error("Invalid replay flags");
  return {
    checkpointName,
    from,
    until,
    limit,
    worker: rest.includes("--worker"),
    adoptLegacy: rest.includes("--adopt-legacy"),
    repairPush: rest.includes("--repair-push"),
  };
}

/** Stable across credential/TLS rotations; binds the configured endpoint and actual relation scope. */
export function discussionReplayDatabaseIdentity(
  databaseUrl: string,
  scope: {
    databaseName: unknown;
    databaseOid: unknown;
    commentsOid: unknown;
    followsOid: unknown;
    repairRelationOids?: unknown[];
  },
) {
  let endpoint: URL;
  try {
    endpoint = new URL(databaseUrl);
    if (!["postgres:", "postgresql:"].includes(endpoint.protocol) || !endpoint.hostname)
      throw Error();
  } catch {
    throw Error("Invalid replay database endpoint");
  }
  const oid = (value: unknown) => {
    if (
      typeof value !== "string" ||
      !/^\d{1,10}$/.test(value) ||
      Number(value) < 1 ||
      Number(value) > 4294967295
    )
      throw Error("Invalid replay database scope");
    return String(Number(value));
  };
  if (
    typeof scope.databaseName !== "string" ||
    !scope.databaseName ||
    scope.databaseName.length > 128
  )
    throw Error("Invalid replay database scope");
  return createHash("sha256")
    .update(
      JSON.stringify([
        "nexus-discussion-replay-v2",
        endpoint.hostname.toLowerCase(),
        endpoint.port || "5432",
        scope.databaseName,
        oid(scope.databaseOid),
        oid(scope.commentsOid),
        oid(scope.followsOid),
        ...(scope.repairRelationOids === undefined
          ? []
          : (() => {
              if (!Array.isArray(scope.repairRelationOids) || scope.repairRelationOids.length !== 6)
                throw Error("Invalid replay repair database scope");
              return ["pending-push-v1", ...scope.repairRelationOids.map(oid)];
            })()),
      ]),
    )
    .digest("hex");
}
