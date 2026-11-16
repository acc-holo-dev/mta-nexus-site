CREATE TABLE "server_heartbeats" (
	"id" text PRIMARY KEY NOT NULL,
	"installation_id" text NOT NULL,
	"server_id" text NOT NULL,
	"status" text DEFAULT 'online' NOT NULL,
	"current_players" integer DEFAULT 0 NOT NULL,
	"max_players" integer DEFAULT 0 NOT NULL,
	"module_version" text,
	"mta_version" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"requester_id" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"proof_url" text,
	"notes" text,
	"reviewer_id" text,
	"review_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "server_heartbeats" ADD CONSTRAINT "server_heartbeats_installation_id_server_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."server_installations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_heartbeats" ADD CONSTRAINT "server_heartbeats_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;