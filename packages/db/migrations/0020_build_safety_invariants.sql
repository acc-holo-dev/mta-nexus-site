-- Fail closed on legacy build rows before enforcing the invariant.
UPDATE builds
SET status = 'retired'
WHERE status = 'published'
  AND NOT (
    scan_status = 'clean'
    AND scanner IS NOT NULL
    AND btrim(scanner) <> ''
    AND scanned_at IS NOT NULL
  );

UPDATE builds
SET scan_status = 'not_scanned',
    scanner = NULL,
    scanned_at = NULL
WHERE scan_status = 'clean'
  AND (
    scanner IS NULL
    OR btrim(scanner) = ''
    OR scanned_at IS NULL
  );

WITH latest_safe AS (
  SELECT DISTINCT ON (product_id)
    product_id,
    version
  FROM builds
  WHERE status = 'published'
    AND scan_status = 'clean'
    AND scanner IS NOT NULL
    AND btrim(scanner) <> ''
    AND scanned_at IS NOT NULL
  ORDER BY product_id, created_at DESC, id DESC
)
UPDATE products AS product
SET current_version = latest_safe.version,
    updated_at = now()
FROM latest_safe
WHERE product.id = latest_safe.product_id
  AND product.status = 'published';

UPDATE products AS product
SET status = 'draft',
    updated_at = now()
WHERE product.status = 'published'
  AND NOT EXISTS (
    SELECT 1
    FROM builds
    WHERE builds.product_id = product.id
      AND builds.status = 'published'
      AND builds.scan_status = 'clean'
      AND builds.scanner IS NOT NULL
      AND btrim(builds.scanner) <> ''
      AND builds.scanned_at IS NOT NULL
  );

ALTER TABLE builds
  ADD CONSTRAINT builds_clean_scan_provenance_check
  CHECK (
    scan_status <> 'clean'
    OR (
      scanner IS NOT NULL
      AND btrim(scanner) <> ''
      AND scanned_at IS NOT NULL
    )
  );

ALTER TABLE builds
  ADD CONSTRAINT builds_published_safe_check
  CHECK (
    status <> 'published'
    OR (
      scan_status = 'clean'
      AND scanner IS NOT NULL
      AND btrim(scanner) <> ''
      AND scanned_at IS NOT NULL
    )
  );
