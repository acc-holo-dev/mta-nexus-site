import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { localCertificateConfig, assertIsolatedProduction, assertInternalIssuer } from '../production-smoke-contract.mjs';
const project = 'nexus-prod-ci-11111111-1111-1111-1111-111111111111';
const fixture = () => ({
  name: project,
  services: {
    app: { restart: 'no', build: { target: 'runtime' }, environment: {
      NODE_ENV: 'production', NEXT_PUBLIC_APP_URL: 'https://nexus-ci.test',
      BUILD_SCANNER: 'clamav', EMAIL_PROVIDER: 'disabled',
    }, volumes: [{ type: 'volume', source: 'uploads' }] },
    postgres: { restart: 'no' }, clamav: { restart: 'no' },
    caddy: { restart: 'no', ports: [
      { host_ip: '127.0.0.1', published: '8080', target: 80 },
      { host_ip: '127.0.0.1', published: '8443', target: 443 },
    ], volumes: [{ type: 'bind', source: '/tmp/test/Caddyfile', target: '/etc/caddy/Caddyfile', read_only: true }] },
  }, volumes: { uploads: { name: `${project}_uploads` } }, networks: { default: { name: `${project}_default` } },
});
test('production Caddy upload limit uses the binary application envelope', () => {
  const caddy = readFileSync(
    new URL('../../deploy/Caddyfile', import.meta.url),
    'utf8',
  );
  assert.match(caddy, /max_size\s+65MiB\b/);
  assert.doesNotMatch(caddy, /max_size\s+65MB\b/);
});
test('only adds a local CA policy, preserving production proxy text', () => {
  const source = '{\n  email {$ACME_EMAIL}\n}\n{$DOMAIN} {\n  reverse_proxy app:3000\n}\n';
  const result = localCertificateConfig(source);
  assert.equal(result.replace('  local_certs\n  skip_install_trust\n', ''), source);
  assert.throws(() => localCertificateConfig('nexus.test {}'));
  assert.throws(() => localCertificateConfig('{\n local_certs\n}\n'));
});
test('allows only a namespaced production stack on loopback', () => {
  assert.doesNotThrow(() => assertIsolatedProduction(fixture(), project, '/tmp/test/Caddyfile'));
});
test('rejects public ports, external volumes and development mode', () => {
  for (const mutate of [
    c => { c.services.caddy.ports[0].host_ip = '0.0.0.0'; },
    c => { c.volumes.uploads.external = true; },
    c => { c.volumes.uploads.name = 'production_uploads'; },
    c => { c.services.app.environment.NODE_ENV = 'development'; },
    c => { c.services.postgres.ports = [{ target: 5432 }]; },
    c => { c.services.app.network_mode = 'host'; },
  ]) {
    const c = fixture(); mutate(c);
    assert.throws(() => assertIsolatedProduction(c, project, '/tmp/test/Caddyfile'));
  }
});
test('rejects public or implicit ACME issuers before Caddy starts', () => {
  assert.doesNotThrow(() => assertInternalIssuer({ apps: { tls: { automation: { policies: [{ issuers: [{ module: 'internal' }] }] } } } }));
  assert.throws(() => assertInternalIssuer({}));
  assert.throws(() => assertInternalIssuer({ apps: { tls: { automation: { policies: [{ issuers: [{ module: 'acme' }] }] } } } }));
});
