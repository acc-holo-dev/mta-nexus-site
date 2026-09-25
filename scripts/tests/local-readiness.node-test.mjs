import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkLocalReadiness } from '../check-local-readiness.mjs';

const healthy = async () => ({ status: 200, json: async () => ({ status: 'ok', database: 'reachable' }) });

test('checks real storage and cleans only its own probe', async (t) => {
  const storagePath = await mkdtemp(join(tmpdir(), 'nexus-readiness-unit-'));
  t.after(() => rm(storagePath, { recursive: true, force: true }));
  await writeFile(join(storagePath, 'existing-file'), 'keep');
  const result = await checkLocalReadiness({ storagePath, fetchFn: healthy });
  assert.equal(result.storage, 'read-write');
  assert.deepEqual(await readdir(storagePath), ['existing-file']);
  assert.equal(await readFile(join(storagePath, 'existing-file'), 'utf8'), 'keep');
});

test('requires reachable database, not merely HTTP 200', async () => {
  const fetchFn = async () => ({ status: 200, json: async () => ({ status: 'ok', database: 'unreachable' }) });
  await assert.rejects(checkLocalReadiness({ storagePath: '/not-used', fetchFn }), /Database is not reachable/);
});

test('fails closed for failed or unavailable HTTP health', async () => {
  await assert.rejects(checkLocalReadiness({ storagePath: '/not-used', fetchFn: async () => ({ status: 503 }) }), /not ready/);
  await assert.rejects(checkLocalReadiness({ storagePath: '/not-used', fetchFn: async () => { throw new Error('offline'); } }), /offline/);
});

test('does not create a missing storage mount', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'nexus-readiness-missing-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await assert.rejects(checkLocalReadiness({ storagePath: join(directory, 'missing'), fetchFn: healthy }), /ENOENT/);
  assert.deepEqual(await readdir(directory), []);
});

test('rejects relative storage paths', async () => {
  await assert.rejects(checkLocalReadiness({ storagePath: './uploads', fetchFn: healthy }), /absolute storage path/);
});
