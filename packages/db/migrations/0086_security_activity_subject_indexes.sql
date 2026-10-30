-- Security Center reads an account's own actions and organization changes that name that account.
-- Subject indexes follow the recorded detail keys (newOwnerId / userId). Other JSON is not indexed.
CREATE INDEX "audit_events_actor_created_id_idx"
  ON "audit_events" ("actor_id", "created_at" DESC, "id" DESC);
--> statement-breakpoint
CREATE INDEX "audit_events_security_new_owner_idx"
  ON "audit_events" (("details"->>'newOwnerId'), "created_at" DESC, "id" DESC)
  WHERE "action" = 'organization.ownership_transferred';
--> statement-breakpoint
CREATE INDEX "audit_events_security_member_subject_idx"
  ON "audit_events" (("details"->>'userId'), "created_at" DESC, "id" DESC)
  WHERE "action" IN (
    'organization.member_added',
    'organization.member_updated',
    'organization.member_removed'
  );
