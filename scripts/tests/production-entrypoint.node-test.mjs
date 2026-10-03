import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

function exercise(migrationExit, serverExit = 0, { withMigrations = true, configExit = 0 } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'nexus-entrypoint-'));
  try {
    mkdirSync(join(root, 'scripts'));
    mkdirSync(join(root, 'bin'));
    mkdirSync(join(root, 'apps/web'), { recursive: true });
    mkdirSync(join(root, 'packages/db'), { recursive: true });
    if (withMigrations) {
      mkdirSync(join(root, 'packages/db/migrations'), { recursive: true });
      writeFileSync(join(root, 'packages/db/migrations/0000_test.sql'), 'select 1;\n');
    }
    writeFileSync(join(root, 'calls'), '');
    copyFileSync(new URL('../start-production.sh', import.meta.url), join(root, 'scripts/start-production.sh'));
    writeFileSync(join(root, 'bin/node'), `#!/bin/sh
printf '%s|%s\\n' "$PWD" "$*" >> "$PROBE_LOG"
if [ "$3" = --input-type=module ]; then exit "$CONFIG_EXIT"; fi
if [ "$1" = --import ]; then exit "$MIGRATION_EXIT"; fi
exit "$SERVER_EXIT"
`, { mode: 0o755 });
    const result = spawnSync('sh', [join(root, 'scripts/start-production.sh')], {
      cwd: tmpdir(), encoding: 'utf8', timeout: 5000,
      env: { PATH: `${join(root, 'bin')}:/usr/bin:/bin`, PROBE_LOG: join(root, 'calls'),
        CONFIG_EXIT: String(configExit), MIGRATION_EXIT: String(migrationExit), SERVER_EXIT: String(serverExit) },
    });
    assert.ifError(result.error);
    const callText = readFileSync(join(root, 'calls'), 'utf8').trim();
    return { status: result.status, calls: callText ? callText.split('\n') : [], root };
  } finally { rmSync(root, { recursive: true, force: true }); }
}

test('runs migrations before the standalone server from isolated runtime directories, without pnpm', () => {
  const result = exercise(0);
  assert.equal(result.status, 0);
  assert.deepEqual(result.calls, [
    `${result.root}/packages/db|--import tsx --input-type=module -e import '@nexus/config';`,
    `${result.root}/packages/db|--import tsx src/migrate.ts`,
    `${result.root}/apps/web|server.js`,
  ]);
});

test('migration failure preserves the failure code and never starts HTTP', () => {
  const result = exercise(7);
  assert.equal(result.status, 7);
  assert.equal(result.calls.length, 2);
});

test('propagates server failure instead of reporting successful startup', () => {
  assert.equal(exercise(0, 9).status, 9);
});

test('missing deployed SQL migrations fails before migration or HTTP node processes start', () => {
  const result = exercise(0, 0, { withMigrations: false });
  assert.notEqual(result.status, 0);
  assert.deepEqual(result.calls, []);
});

test('invalid web configuration stops before migrations and HTTP', () => {
  const result = exercise(0, 0, { configExit: 3 });
  assert.equal(result.status, 3);
  assert.equal(result.calls.length, 1);
  assert.match(result.calls[0], /@nexus\/config/);
});
