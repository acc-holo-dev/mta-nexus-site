/** Operator tooling for exhausted notification fanout / admission recovery. */

export const NOTIFICATION_DELIVERY_EXHAUSTED_ATTEMPTS = 5;
export const NOTIFICATION_DELIVERY_RESET_ACK = "NEXUS_NOTIFICATION_DELIVERY_RESET_ACK";
export const NOTIFICATION_DELIVERY_LIST_LIMIT_DEFAULT = 20;
export const NOTIFICATION_DELIVERY_LIST_LIMIT_MAX = 100;

export const NOTIFICATION_DELIVERY_CHANNELS = Object.freeze({
  report: Object.freeze({
    id: "report",
    table: "report_notification_deliveries",
    idColumn: "report_id",
    kind: "fanout",
    description: "Moderator report inbox fanout",
  }),
  support: Object.freeze({
    id: "support",
    table: "support_notification_deliveries",
    idColumn: "message_id",
    kind: "fanout",
    description: "Support moderator inbox fanout",
  }),
  verification: Object.freeze({
    id: "verification",
    table: "verification_notification_deliveries",
    idColumn: "verification_request_id",
    kind: "fanout",
    description: "Verification moderator inbox fanout",
  }),
  discussion: Object.freeze({
    id: "discussion",
    table: "discussion_notification_deliveries",
    idColumn: "comment_id",
    kind: "fanout",
    description: "Discussion participant/follower fanout",
  }),
  publication: Object.freeze({
    id: "publication",
    table: "publication_notification_deliveries",
    idColumn: "content_id",
    kind: "fanout",
    description: "Server-publication follower fanout",
  }),
  admission: Object.freeze({
    id: "admission",
    table: "web_push_admission_recovery",
    idColumn: "notification_id",
    kind: "admission",
    description: "Optional Web Push admission recovery",
  }),
  build_incident: Object.freeze({
    id: "build_incident",
    table: "build_incident_notification_deliveries",
    idColumn: "build_id",
    kind: "fanout",
    description: "SEC-002 quarantined-build downloader notices",
  }),
});

export function listNotificationDeliveryChannels() {
  return Object.freeze(Object.values(NOTIFICATION_DELIVERY_CHANNELS));
}

export function resolveNotificationDeliveryChannel(raw) {
  if (typeof raw !== "string") return null;
  return NOTIFICATION_DELIVERY_CHANNELS[raw.trim().toLowerCase()] ?? null;
}

export function parseNotificationDeliveryListLimit(
  raw,
  fallback = NOTIFICATION_DELIVERY_LIST_LIMIT_DEFAULT,
) {
  if (raw === undefined || raw === null || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > NOTIFICATION_DELIVERY_LIST_LIMIT_MAX) {
    throw new RangeError(
      `List limit must be an integer from 1 to ${NOTIFICATION_DELIVERY_LIST_LIMIT_MAX}`,
    );
  }
  return value;
}

export function assertResetAcknowledgement(env = process.env) {
  if (env[NOTIFICATION_DELIVERY_RESET_ACK] !== "YES") {
    throw new Error(
      `Refusing reset without ${NOTIFICATION_DELIVERY_RESET_ACK}=YES (never resets all jobs).`,
    );
  }
}

export function parseNotificationDeliveryOperatorArgs(argv) {
  const args = [...argv];
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    return Object.freeze({ command: "help" });
  }
  const command = args.shift();
  if (command !== "list" && command !== "reset") {
    throw new Error(`Unknown command "${command}". Use list or reset.`);
  }

  let channel = null;
  let id = null;
  let limit = NOTIFICATION_DELIVERY_LIST_LIMIT_DEFAULT;
  while (args.length) {
    const token = args.shift();
    if (token === "--channel") {
      const value = args.shift();
      channel = resolveNotificationDeliveryChannel(value);
      if (!channel) throw new Error(`Unknown channel "${value ?? ""}".`);
      continue;
    }
    if (token === "--id") {
      id = args.shift() ?? null;
      if (!id?.trim()) throw new Error("Reset/list --id requires a non-empty identifier.");
      id = id.trim();
      continue;
    }
    if (token === "--limit") {
      limit = parseNotificationDeliveryListLimit(args.shift());
      continue;
    }
    if (token === "--help" || token === "-h") {
      return Object.freeze({ command: "help" });
    }
    throw new Error(`Unsupported option "${token}".`);
  }

  if (command === "list") {
    return Object.freeze({ command: "list", channel, limit });
  }

  if (!channel) throw new Error("reset requires --channel <name>.");
  if (!id) throw new Error("reset requires --id <source-id> (one verified exhausted job only).");
  return Object.freeze({ command: "reset", channel, id });
}

export function usageText() {
  const channels = listNotificationDeliveryChannels()
    .map((item) => `  ${item.id.padEnd(14)} ${item.idColumn}  (${item.description})`)
    .join("\n");
  return (
    "Usage:\n" +
    "  pnpm --filter @nexus/db notifications:delivery list [--channel <name>] [--limit N]\n" +
    "  pnpm --filter @nexus/db notifications:delivery reset --channel <name> --id <id>\n\n" +
    "Reset requires " +
    NOTIFICATION_DELIVERY_RESET_ACK +
    "=YES and never resets every job.\n" +
    "Admission resets also require created_at within the last 24 hours.\n" +
    "Channels:\n" +
    channels +
    "\n"
  );
}
