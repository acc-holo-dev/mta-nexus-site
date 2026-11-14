-- Replace the abandoned server-installed agent model with observations collected
-- by NEXUS from public MTA sources. Historical heartbeat data is intentionally
-- removed because it cannot be represented as authoritative master-list data.
DROP TABLE IF EXISTS "server_heartbeats";
DROP TABLE IF EXISTS "server_installations";

ALTER TABLE "servers" RENAME COLUMN "last_heartbeat_at" TO "last_observed_at";
ALTER TABLE "servers" ADD COLUMN "observation_source" text;
ALTER TABLE "servers" ALTER COLUMN "owner_id" DROP NOT NULL;
ALTER TABLE "servers" DROP CONSTRAINT IF EXISTS "servers_owner_id_users_id_fk";
ALTER TABLE "servers" ADD CONSTRAINT "servers_owner_id_users_id_fk"
  FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null;
ALTER TABLE "servers" ALTER COLUMN "current_players" DROP NOT NULL;
ALTER TABLE "servers" ALTER COLUMN "current_players" DROP DEFAULT;
ALTER TABLE "servers" ALTER COLUMN "max_players" DROP NOT NULL;
ALTER TABLE "servers" ALTER COLUMN "max_players" DROP DEFAULT;

-- Zero was previously used as an offline fallback. Preserve honesty by turning
-- rows without a real observation timestamp into unknown live state.
UPDATE "servers"
SET "current_players" = NULL, "max_players" = NULL
WHERE "last_observed_at" IS NULL;

DROP INDEX IF EXISTS "servers_last_heartbeat_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "servers_endpoint_idx" ON "servers" ("ip_address", "port");
CREATE INDEX IF NOT EXISTS "servers_last_observed_idx" ON "servers" ("last_observed_at");

CREATE TABLE "server_observations" (
  "id" text PRIMARY KEY NOT NULL,
  "server_id" text NOT NULL,
  "source" text NOT NULL,
  "source_sequence" text,
  "name" text,
  "game_mode" text,
  "map_name" text,
  "mta_version" text,
  "current_players" integer,
  "max_players" integer,
  "passworded" boolean,
  "responding" boolean,
  "observed_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "server_observations_server_id_servers_id_fk"
    FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade
);

CREATE INDEX "server_observations_server_time_idx"
  ON "server_observations" ("server_id", "observed_at");
CREATE UNIQUE INDEX "server_observations_source_sequence_idx"
  ON "server_observations" ("source", "source_sequence", "server_id");
