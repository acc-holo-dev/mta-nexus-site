-- Extend the existing own-command partial index for reviewed group resumption.
DROP INDEX audit_events_release_watch_history_idx;
CREATE INDEX audit_events_release_watch_history_idx ON audit_events(actor_id,created_at DESC,id DESC) WHERE actor_type='user' AND action IN ('library.release_watch_changed','library.release_watches_disabled','library.release_watches_resumed','library.collection_release_watches_enabled');
