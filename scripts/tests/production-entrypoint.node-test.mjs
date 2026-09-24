import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

function exercise(migrationExit, serverExit = 0) {
  const root = mkdtempSync(join(tmpdir(), 'nexus-entrypoint-'));
  try {
    mkdirSync(join(root, 'scripts'));
    mkdirSync(join(root, 'bin'));
    mkdirSync(join(root, 'apps/web'), { recursive: true });
    copyFileSync(new URL('../start-production.sh', import.meta.url), join(root, 'scripts/start-production.sh'));
    writeFileSync(join(root, 'bin/node'), `#!/bin/sh
printf '%s|%s\\n' "$PWD" "$*" >> "$PROBE_LOG"
if [ "$1" = --import ]; then exit "$MIGRATION_EXIT"; fi
exit "$SERVER_EXIT"
`, { mode: 0o755 });
    const result = spawnSync('sh', [join(root, 'scripts/start-production.sh')], {
      cwd: tmpdir(), encoding: 'utf8', timeout: 5000,
      env: { PATH: `${join(root, 'bin')}:/usr/bin:/bin`, PROBE_LOG: join(root, 'calls'),
        MIGRATION_EXIT: String(migrationExit), SERVER_EXIT: String(serverExit) },
    });
    assert.ifError(result.error);
    return { status: result.status, calls: readFileSync(join(root, 'calls'), 'utf8').trim().split('\n'), root };
  } finally { rmSync(root, { recursive: true, force: true }); }
}

test('runs migrations before Next.js from the correct directories, without pnpm', () => {
  const result = exercise(0);
  assert.equal(result.status, 0);
  assert.deepEqual(result.calls, [
    `${result.root}|--import tsx packages/db/src/migrate.ts`,
    `${result.root}/apps/web|node_modules/next/dist/bin/next start --hostname 0.0.0.0`,
  ]);
});

test('migration failure preserves the failure code and never starts HTTP', () => {
  const result = exercise(7);
  assert.equal(result.status, 7);
  assert.equal(result.calls.length, 1);
});

test('propagates server failure instead of reporting successful startup', () => {
  assert.equal(exercise(0, 9).status, 9);
});
