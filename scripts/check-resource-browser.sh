#!/usr/bin/env bash
set -euo pipefail

# Reuse the exact disposable production rehearsal and keep its cleanup trap.
source "$(dirname "$0")/check-production-startup.sh"
: "${NEXUS_BROWSER_TOOLS:?Browser-only tools are required}"
: "${NEXUS_BROWSER_REPORT_DIR:?A browser report directory is required}"

export NEXUS_BROWSER_BASE_URL="https://$domain:8443"
export NEXUS_BROWSER_HOME="$work/resource-browser-home"
mkdir -p "$NEXUS_BROWSER_HOME/.pki/nssdb" "$NEXUS_BROWSER_REPORT_DIR"
certutil -d "sql:$NEXUS_BROWSER_HOME/.pki/nssdb" -N --empty-password
certutil -d "sql:$NEXUS_BROWSER_HOME/.pki/nssdb" -A -n nexus-resource-ci -t 'C,,' -i "$work/root.crt"

fixture=$(node -e 'process.stdout.write(require("node:crypto").randomUUID().replace(/-/g, ""))')
short=${fixture:0:12}
author_id="usr_resource_browser_$short"
product_id="prd_resource_browser_$short"
build_id="bld_resource_browser_$short"
product_slug="j5-browser-resource-$short"
storage_key="ci-resource-browser/$short.zip"
payload_file="$work/j5-browser-resource.zip"
node --input-type=module - "$payload_file" <<'NODE'
import { randomBytes } from 'node:crypto';
import { openSync, closeSync, writeFileSync } from 'node:fs';
import { MAX_UPLOAD_FILE_SIZE_BYTES } from './packages/domain/src/upload-limits.ts';
const block = randomBytes(1024 * 1024);
const file = openSync(process.argv[2], 'wx');
try {
  for (let written = 0; written < MAX_UPLOAD_FILE_SIZE_BYTES; written += block.length) {
    writeFileSync(file, block.subarray(0, Math.min(block.length, MAX_UPLOAD_FILE_SIZE_BYTES - written)));
  }
} finally {
  closeSync(file);
}
NODE
expected_sha=$(sha256sum "$payload_file" | awk '{print $1}')
file_size=$(wc -c < "$payload_file" | tr -d ' ')

"${pc[@]}" exec -T app sh -c 'mkdir -p /data/uploads/ci-resource-browser && cat > "/data/uploads/'"$storage_key"'"' < "$payload_file"

sql "
INSERT INTO users (
  id, email, username, display_name, role, created_at, updated_at
) VALUES (
  '$author_id',
  'resource-browser-author-$short@example.invalid',
  'resource_browser_author_$short',
  'J5 Browser Fixture Author',
  'developer',
  now(),
  now()
);

INSERT INTO products (
  id, title, slug, description, type, status, author_id,
  price, currency, license_model, tags, current_version,
  rating_average, rating_count, sales_count, is_featured,
  screenshots, compatibility, created_at, updated_at
) VALUES (
  '$product_id',
  'J5 Browser Resource',
  '$product_slug',
  'Disposable resource for the real claim-to-download browser journey.',
  'script',
  'published',
  '$author_id',
  0,
  'USD',
  'unlimited',
  '[]'::jsonb,
  '1.0.0',
  0,
  0,
  0,
  false,
  '[]'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

INSERT INTO builds (
  id, product_id, version, release_notes, status, storage_key,
  sha256_hash, file_size_bytes, file_name, mime_type,
  scan_status, scanner, scanned_at, is_signed, created_at
) VALUES (
  '$build_id',
  '$product_id',
  '1.0.0',
  'Disposable J5 browser fixture.',
  'published',
  '$storage_key',
  '$expected_sha',
  $file_size,
  'j5-browser-resource.zip',
  'application/zip',
  'clean',
  'browser-fixture',
  now(),
  false,
  now()
);
"

export NEXUS_RESOURCE_BROWSER_PRODUCT_ID="$product_id"
export NEXUS_RESOURCE_BROWSER_PRODUCT_SLUG="$product_slug"
export NEXUS_RESOURCE_BROWSER_PRODUCT_TITLE="J5 Browser Resource"
export NEXUS_RESOURCE_BROWSER_EXPECTED_SHA256="$expected_sha"
export NEXUS_RESOURCE_BROWSER_EXPECTED_SIZE="$file_size"

"$NEXUS_BROWSER_TOOLS/node_modules/.bin/playwright" test \
  --config=playwright.ci.config.mjs \
  scripts/tests/resource-claim-download.playwright.mjs

claims=$(sql "SELECT count(*) FROM entitlements WHERE resource_id = '$product_id' AND permission = 'product.download';")
[[ "$claims" == 1 ]]
sales=$(sql "SELECT sales_count FROM products WHERE id = '$product_id';")
[[ "$sales" == 1 ]]

echo "PASS: J5 browser claimed one entitlement, incremented library additions once and downloaded the seeded build"
