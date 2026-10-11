-- No inferred evidence for earlier versions. Only the upload path inspects actual bytes.
ALTER TABLE builds ADD COLUMN package_evidence jsonb;
--> statement-breakpoint
ALTER TABLE builds ADD CONSTRAINT builds_package_evidence_check CHECK (
  package_evidence IS NULL OR COALESCE((
    jsonb_typeof(package_evidence) = 'object' AND
    octet_length(package_evidence::text) <= 1048576 AND
    package_evidence->>'schemaVersion' = '1' AND
    package_evidence->>'inspector' = 'nexus-package-v1' AND
    package_evidence->>'format' IN ('zip', 'rar', '7z', 'lua') AND
    package_evidence->>'sha256Hash' = sha256_hash AND sha256_hash ~ '^[a-f0-9]{64}$' AND
    package_evidence->>'fileSizeBytes' = file_size_bytes::text AND file_size_bytes > 0 AND
    jsonb_typeof(package_evidence->'inspectedAt') = 'string' AND
    length(package_evidence->>'inspectedAt') BETWEEN 20 AND 40 AND
    ((package_evidence->>'format' = 'zip' AND package_evidence->>'status' = 'checked' AND
      jsonb_typeof(package_evidence->'archive') = 'object' AND
      CASE WHEN jsonb_typeof(package_evidence->'files') = 'array' THEN
        jsonb_array_length(package_evidence->'files') BETWEEN 0 AND 1000 AND
        package_evidence->'archive'->>'files' = jsonb_array_length(package_evidence->'files')::text
      ELSE false END AND
      package_evidence->>'manifestStatus' IN ('single', 'missing', 'multiple') AND
      ((package_evidence->>'manifestStatus' = 'single' AND jsonb_typeof(package_evidence->'manifest') = 'object') OR
       (package_evidence->>'manifestStatus' IN ('missing', 'multiple') AND package_evidence->'manifest' = 'null'::jsonb))) OR
     (package_evidence->>'format' IN ('rar', '7z', 'lua') AND package_evidence->>'status' = 'not_inspected' AND
      package_evidence->>'manifestStatus' = 'not_inspected' AND package_evidence->'archive' = 'null'::jsonb AND package_evidence->'manifest' = 'null'::jsonb AND package_evidence->'files' = 'null'::jsonb))
  ), false)
);
--> statement-breakpoint
CREATE FUNCTION nexus_build_package_evidence_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.package_evidence IS DISTINCT FROM OLD.package_evidence THEN
    RAISE EXCEPTION 'Package evidence can only be recorded with a new build' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER builds_package_evidence_guard BEFORE UPDATE ON builds
  FOR EACH ROW EXECUTE FUNCTION nexus_build_package_evidence_guard();
