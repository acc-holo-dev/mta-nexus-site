import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractSpec, makeFixture, assertNamedDataMount } from '../check-postgres-persistence.mjs';

const config = (target = '/var/lib/postgresql') => ({ services: { postgres: {
  image: 'postgres:18-alpine', environment: { POSTGRES_PASSWORD: 'must-not-be-copied' },
  container_name: 'nexus-postgres', ports: ['5432:5432'],
  volumes: [{ type: 'volume', source: 'pgdata', target }],
} } });

test('extracts both current and historical mount targets for runtime regression', () => {
  for (const target of ['/var/lib/postgresql', '/var/lib/postgresql/data']) {
    assert.equal(extractSpec(config(target)).target, target);
  }
});

test('rejects a different image, bind mount and unreviewed extra volume', () => {
  const other = config(); other.services.postgres.image = 'postgres:17-alpine';
  assert.throws(() => extractSpec(other));
  const bind = config(); bind.services.postgres.volumes[0].type = 'bind';
  assert.throws(() => extractSpec(bind));
  const extra = config(); extra.services.postgres.volumes.push({ type: 'bind', source: '/', target: '/host' });
  assert.throws(() => extractSpec(extra));
});

test('fixture never inherits app credentials, ports, container names or host mounts', () => {
  const fixture = makeFixture(extractSpec(config()), 'sha256:test-image', 'unique-test-token');
  const service = fixture.services.postgres;
  assert.deepEqual(Object.keys(fixture.services), ['postgres']);
  assert.equal(service.network_mode, 'none');
  assert.equal(service.ports, undefined);
  assert.equal(service.container_name, undefined);
  assert.equal(service.environment.POSTGRES_PASSWORD, 'unique-test-token');
  assert.equal(service.environment.DATABASE_URL, undefined);
  assert.equal(fixture.volumes.pgdata.external, undefined);
  assert(!JSON.stringify(fixture).includes('must-not-be-copied'));
});

test('accepts only the intended writable named volume covering actual PGDATA', () => {
  const data = '/var/lib/postgresql/18/docker';
  const intended = { Type: 'volume', Name: 'unique_pgdata', Destination: '/var/lib/postgresql', RW: true };
  assert.doesNotThrow(() => assertNamedDataMount([intended], data, 'unique_pgdata'));
  assert.throws(() => assertNamedDataMount([{ ...intended, Destination: '/var/lib/postgresql/data' }], data, 'unique_pgdata'));
  assert.throws(() => assertNamedDataMount([{ ...intended, Name: 'anonymous-volume' }], data, 'unique_pgdata'));
  assert.throws(() => assertNamedDataMount([{ ...intended, RW: false }], data, 'unique_pgdata'));
  assert.throws(() => assertNamedDataMount([intended, {
    ...intended, Name: 'shadow-volume', Destination: '/var/lib/postgresql/18',
  }], data, 'unique_pgdata'));
});

test('Compose render supplies an isolated proxy secret required by the full config', async () => {
  const { readFile } = await import('node:fs/promises');
  const script = await readFile(new URL('../check-postgres-persistence.mjs', import.meta.url), 'utf8');
  assert.match(script, /TRUSTED_PROXY_SECRET: 'disposable-persistence-proxy-config-only'/u);
});
