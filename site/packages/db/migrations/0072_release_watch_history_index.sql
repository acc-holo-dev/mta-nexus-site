-- Keep prepared own-watch-history reads on the literal action predicate.
CREATE INDEX audit_events_release_watch_history_idx ON audit_events(actor_id,created_at DESC,id DESC) WHERE actor_type='user' AND action IN ('library.release_watch_changed','library.release_watches_disabled','library.collection_release_watches_enabled');
