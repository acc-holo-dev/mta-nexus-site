import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  PRODUCTION_UPLOAD_ENVELOPE_BYTES,
  assertProductionUploadBodyLimit,
  localCertificateConfig,
  assertIsolatedProduction,
  assertInternalIssuer,
} from '../production-smoke-contract.mjs';
const project = 'nexus-prod-ci-11111111-1111-1111-1111-111111111111';
const fixture = () => ({
  name: project,
  services: {
    app: {
      image: 'nexus-ci:test',
      restart: 'no',
      build: { target: 'runtime' },
      environment: {
        NODE_ENV: 'production',
        NEXT_PUBLIC_APP_URL: 'https://nexus-ci.test',
        BUILD_SCANNER: 'clamav',
        EMAIL_PROVIDER: 'disabled',
      },
      volumes: [{ type: 'volume', source: 'uploads' }],
    },
    'push-worker': {
      image: 'nexus-ci:test',
      restart: 'unless-stopped',
      user: 'node',
      environment: { HOME: '/tmp', TMPDIR: '/tmp' },
      read_only: true,
      init: true,
      cap_drop: ['ALL'],
      security_opt: ['no-new-privileges:true'],
      pids_limit: 128,
      stop_signal: 'SIGTERM',
      stop_grace_period: '1m15s',
      tmpfs: ['/tmp:rw,noexec,nosuid,nodev,size=16m,mode=1777'],
    },
    postgres: { restart: 'no' }, clamav: { restart: 'no' },
    caddy: { restart: 'no', ports: [
      { host_ip: '127.0.0.1', published: '8080', target: 80 },
      { host_ip: '127.0.0.1', published: '8443', target: 443 },
    ], volumes: [{ type: 'bind', source: '/tmp/test/Caddyfile', target: '/etc/caddy/Caddyfile', read_only: true }] },
  }, volumes: { uploads: { name: `${project}_uploads` } }, networks: { default: { name: `${project}_default` } },
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
    c => { c.services['push-worker'].image = 'different-image:test'; },
    c => { c.services['push-worker'].environment.HOME = '/home/node'; },
    c => { c.services['push-worker'].read_only = false; },
    c => { c.services['push-worker'].cap_drop = []; },
    c => { c.services['push-worker'].security_opt = []; },
    c => { c.services['push-worker'].pids_limit = 512; },
    c => { c.services['push-worker'].stop_grace_period = '10s'; },
    c => { c.services['push-worker'].tmpfs = []; },
    c => { c.services['push-worker'].restart = 'no'; },
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


test('pins the production proxy body limit to the application build envelope', () => {
  const caddy = readFileSync('deploy/Caddyfile', 'utf8');
  const storage = readFileSync('packages/storage/src/storage-service.ts', 'utf8');
  const uploadRoute = readFileSync('apps/web/src/app/api/products/[id]/builds/route.ts', 'utf8');
  assert.equal(PRODUCTION_UPLOAD_ENVELOPE_BYTES, 65 * 1024 * 1024);
  assert.doesNotThrow(() => assertProductionUploadBodyLimit(caddy));
  assert.match(storage, /MAX_FILE_SIZE_BYTES\s*=\s*MAX_UPLOAD_FILE_SIZE_BYTES/u);
  assert.match(uploadRoute, /MAX_BUILD_MULTIPART_OVERHEAD_BYTES/u);
  assert.throws(() => assertProductionUploadBodyLimit(caddy.replace('68157440', '65000000')), /65 MiB build-upload envelope/u);
});

test('requires matching declared-length and streaming limits', () => {
  const source = readFileSync('deploy/Caddyfile', 'utf8');
  assert.doesNotThrow(() => assertProductionUploadBodyLimit(source));
  assert.throws(() => assertProductionUploadBodyLimit(source.replace('> 68157440', '> 68157441')));
  assert.throws(() => assertProductionUploadBodyLimit(source.replace('respond @oversized_body "Request body too large" 413', '')));
});

test('live smoke checks both sides of the declared upload boundary', () => {
  const source = readFileSync('scripts/check-production-startup.sh', 'utf8');
  assert.match(source, /truncate -s \$\(\(proxy_upload_limit \+ 1\)\)/u);
  assert.match(source, /truncate -s "\$proxy_upload_limit"/u);
  assert.match(source, /\[\[ \$at_limit_code == 405 \]\]/u);
  assert.match(source, /\[\[ \$oversized_code == 413 \]\]/u);
});

test('production smoke proves offline-cache opt-in disappears when a session cookie is present', () => {
  const source = readFileSync('scripts/check-production-startup.sh', 'utf8');
  assert.match(source, /offline-cache-policy/u);
  assert.match(source, /x-nexus-offline-cache: public-readonly-v1/ui);
  assert.match(source, /Cookie: nexus_session=invalid-smoke-token/u);
  assert.match(source, /session-bearing public page was marked for offline document caching/u);
});

test('browser-only acceptance resolves the disposable origin for Node without disabling TLS verification', () => {
  const startup = readFileSync('scripts/check-production-startup.sh', 'utf8');
  const playwright = readFileSync('playwright.ci.config.mjs', 'utf8');
  assert.match(startup, /getent ahostsv4 "\$domain"/u);
  assert.match(startup, /127\.0\.0\.1\\t%s\\n/u);
  assert.match(startup, /NODE_EXTRA_CA_CERTS="\$work\/root\.crt"/u);
  assert.match(playwright, /ignoreHTTPSErrors:\s*false/u);
  assert.doesNotMatch(playwright, /ignoreHTTPSErrors:\s*true/u);
});
