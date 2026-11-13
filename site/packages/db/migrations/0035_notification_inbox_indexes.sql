-- Additive inbox indexes. Normal transactional migration; schedule a maintenance window.
CREATE INDEX notifications_recipient_created_id_idx
  ON notifications (recipient_id, created_at DESC, id DESC);
--> statement-breakpoint
CREATE INDEX notifications_unread_recipient_created_id_idx
  ON notifications (recipient_id, created_at DESC, id DESC)
  WHERE is_read = false;
