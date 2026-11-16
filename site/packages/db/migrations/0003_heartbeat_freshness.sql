ALTER TABLE "servers" ADD COLUMN "last_heartbeat_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX "servers_last_heartbeat_idx" ON "servers" USING btree ("last_heartbeat_at");
