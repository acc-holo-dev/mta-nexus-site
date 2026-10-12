-- Own-account chronological inspection without rewriting immutable receipts.
CREATE INDEX library_collection_receipts_user_history_idx
  ON library_collection_receipts (user_id, created_at DESC, id DESC);
