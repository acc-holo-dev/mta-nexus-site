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
  screenshots, compatibility, thumbnail_url, created_at, updated_at
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
  'https://nexus-ci.test:8443/ci-preview.png',
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

portfolio_sql=$(PORTFOLIO_STORAGE_KEY="$storage_key" PORTFOLIO_SHA256="$expected_sha" node --input-type=module <<'NODE'
import { readFileSync } from 'node:fs';
const key = process.env.PORTFOLIO_STORAGE_KEY;
const hash = process.env.PORTFOLIO_SHA256;
if (!/^ci-resource-browser\/[a-f0-9]+\.zip$/.test(key) || !/^[a-f0-9]{64}$/.test(hash)) throw new Error('Invalid disposable portfolio fixture');
process.stdout.write(readFileSync('scripts/fixtures/public-portfolio.sql', 'utf8').replaceAll('__STORAGE_KEY__', key).replaceAll('__SHA256__', hash));
NODE
)
sql "$portfolio_sql" > /dev/null

# Create real password accounts, then grant disposable CI roles directly in the fixture DB.
export NEXUS_AUTHOR_BROWSER_EMAIL="author-cabinet-$short@example.invalid"
export NEXUS_MODERATOR_BROWSER_EMAIL="moderator-cabinet-$short@example.invalid"
export NEXUS_AUTHOR_BROWSER_PASSWORD="Ci-$(openssl rand -hex 24)"
echo "::add-mask::$NEXUS_AUTHOR_BROWSER_PASSWORD"
for role in developer moderator; do
  if [[ "$role" == developer ]]; then account_email="$NEXUS_AUTHOR_BROWSER_EMAIL"; else account_email="$NEXUS_MODERATOR_BROWSER_EMAIL"; fi
  account_json=$(ACCOUNT_EMAIL="$account_email" ACCOUNT_USERNAME="cabinet_${role}_$short" node -e 'process.stdout.write(JSON.stringify({email:process.env.ACCOUNT_EMAIL,username:process.env.ACCOUNT_USERNAME,password:process.env.NEXUS_AUTHOR_BROWSER_PASSWORD}))')
  "${https[@]}" --fail -H 'Content-Type: application/json' --data "$account_json" "https://$domain:8443/api/auth/register" > "$work/cabinet-$role.json"
  sql "UPDATE users SET role = '$role' WHERE email = '$account_email';" > /dev/null
done

"$NEXUS_BROWSER_TOOLS/node_modules/.bin/playwright" test \
  --config=playwright.ci.config.mjs \
  scripts/tests/resource-claim-download.playwright.mjs \
  scripts/tests/author-workspace.playwright.mjs \
  scripts/tests/shell-accessibility.playwright.mjs \
  scripts/tests/public-portfolio.playwright.mjs

claims=$(sql "SELECT count(*) FROM entitlements WHERE resource_id = '$product_id' AND permission = 'product.download';")
[[ "$claims" == 1 ]]
sales=$(sql "SELECT sales_count FROM products WHERE id = '$product_id';")
[[ "$sales" == 1 ]]

echo "PASS: J5 browser claimed one entitlement, incremented library additions once and downloaded the seeded build"

created_product=$(sql "SELECT id FROM products WHERE author_id = (SELECT id FROM users WHERE email = '$NEXUS_AUTHOR_BROWSER_EMAIL');")
[[ "$created_product" =~ ^prd_[a-zA-Z0-9_-]+$ ]]
[[ $(sql "SELECT status FROM products WHERE id = '$created_product';") == draft ]]
[[ $(sql "SELECT count(*) FROM builds WHERE product_id = '$created_product' AND scan_status = 'clean' AND scanner IS NOT NULL AND scanned_at IS NOT NULL;") == 2 ]]
[[ $(sql "SELECT count(*) FROM builds WHERE product_id = '$created_product' AND status = 'retired';") == 1 ]]
[[ $(sql "SELECT count(*) FROM builds WHERE product_id = '$created_product' AND status = 'rejected';") == 1 ]]
[[ $(sql "SELECT count(*) FROM audit_events WHERE target_id = '$created_product' AND action = 'product.details_updated';") == 1 ]]
for decision in submitted_for_review approved rejected retired; do
  expected_count=1
  [[ "$decision" != submitted_for_review ]] || expected_count=2
  [[ $(sql "SELECT count(*) FROM audit_events WHERE action = 'build.$decision' AND target_id IN (SELECT id FROM builds WHERE product_id = '$created_product');") == "$expected_count" ]]
done
[[ $(sql "SELECT count(*) FROM entitlements WHERE resource_id = '$created_product' AND permission = 'product.download';") == 1 ]]
echo "PASS: real author lifecycle, clean scans, decisions, audit trail, entitlement and final-public-build retirement persisted"

[[ $(sql "SELECT count(*) FROM notifications WHERE recipient_id = (SELECT id FROM users WHERE email = '$NEXUS_AUTHOR_BROWSER_EMAIL') AND data->>'kind' = 'build_review';") == 2 ]]
[[ $(sql "SELECT count(*) FROM notifications WHERE recipient_id = (SELECT id FROM users WHERE email = '$NEXUS_AUTHOR_BROWSER_EMAIL') AND data->>'kind' = 'build_review' AND is_read = false;") == 0 ]]
echo "PASS: author approval/rejection notifications persisted once and were marked read"

export NEXUS_DOWNLOAD_PROBE_APP="$("${pc[@]}" ps -q app)"
export NEXUS_DOWNLOAD_PROBE_CA="$work/root.crt"
node scripts/check-download-network.mjs
