CREATE TABLE license_runtime_bindings (
  license_id text PRIMARY KEY REFERENCES licenses(id) ON DELETE CASCADE,
  server_id text NOT NULL,
  organization_id text,
  endpoint_revision integer NOT NULL,
  token_digest text,
  token_issued_at timestamptz,
  token_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT license_runtime_revision_check CHECK (endpoint_revision >= 0),
  CONSTRAINT license_runtime_digest_check CHECK (token_digest IS NULL OR token_digest ~ '^[a-f0-9]{64}$'),
  CONSTRAINT license_runtime_token_check CHECK (
    (token_digest IS NULL AND token_issued_at IS NULL AND token_expires_at IS NULL)
    OR (token_digest IS NOT NULL AND token_issued_at IS NOT NULL AND token_expires_at IS NOT NULL
        AND token_expires_at > token_issued_at AND token_expires_at <= token_issued_at + interval '720 hours')
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX license_runtime_token_digest_idx ON license_runtime_bindings(token_digest);
--> statement-breakpoint
CREATE INDEX license_runtime_server_idx ON license_runtime_bindings(server_id);
