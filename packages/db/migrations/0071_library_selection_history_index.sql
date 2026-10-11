-- Private selection history projects only the actor's own recorded actions.
CREATE INDEX audit_events_library_selection_history_idx ON audit_events(actor_id,created_at DESC,id DESC) WHERE actor_type='user' AND target_type='product' AND action='library.release_selected';
