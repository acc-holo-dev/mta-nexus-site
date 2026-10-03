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
  assert.equal(result.publication, 'atomic-no-replace');
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

test('fails and cleans its probe when the mount cannot publish with hard links', async (t) => {
  const storagePath = await mkdtemp(join(tmpdir(), 'nexus-readiness-links-'));
  t.after(() => rm(storagePath, { recursive: true, force: true }));
  await writeFile(join(storagePath, 'existing-file'), 'keep');
  await assert.rejects(checkLocalReadiness({ storagePath, fetchFn: healthy,
    linkFn: async () => { throw Object.assign(new Error('hard links unsupported'), { code: 'ENOTSUP' }); },
  }), { code: 'ENOTSUP' });
  assert.deepEqual(await readdir(storagePath), ['existing-file']);
  assert.equal(await readFile(join(storagePath, 'existing-file'), 'utf8'), 'keep');
});

test('concurrent probes do not overwrite or remove each other or existing data', async (t) => {
  const storagePath = await mkdtemp(join(tmpdir(), 'nexus-readiness-concurrent-'));
  t.after(() => rm(storagePath, { recursive: true, force: true }));
  await writeFile(join(storagePath, 'existing-file'), 'keep');
  const results = await Promise.all(Array.from({ length: 4 }, () =>
    checkLocalReadiness({ storagePath, fetchFn: healthy })));
  assert.ok(results.every((result) => result.publication === 'atomic-no-replace'));
  assert.deepEqual(await readdir(storagePath), ['existing-file']);
  assert.equal(await readFile(join(storagePath, 'existing-file'), 'utf8'), 'keep');
});
