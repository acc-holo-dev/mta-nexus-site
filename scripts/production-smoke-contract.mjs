import assert from 'node:assert/strict';

export const PRODUCTION_UPLOAD_ENVELOPE_BYTES = 65 * 1024 * 1024;

// Preserve every production proxy directive; change only the test CA policy.
export function assertProductionUploadBodyLimit(source) {
  const match = source.match(/request_body\s*\{[\s\S]*?max_size\s+(\d+)[\s\S]*?\}/u);
  assert(match, 'Production Caddyfile must declare a request_body max_size');
  assert.equal(
    Number(match[1]),
    PRODUCTION_UPLOAD_ENVELOPE_BYTES,
    'Production proxy body limit must equal the 65 MiB build-upload envelope',
  );
}

export function localCertificateConfig(source) {
  assert(source.startsWith('{\n'), 'Review the Caddy global block before changing this fixture');
  assert(!/\b(local_certs|acme_ca|tls)\b/.test(source), 'Explicit TLS settings require fixture review');
  return source.replace('{\n', '{\n  local_certs\n  skip_install_trust\n');
}

export function assertIsolatedProduction(config, project, caddyFile) {
  assert.match(project, /^nexus-prod-ci-[a-f0-9-]{36}$/);
  assert.equal(config.name, project);
  assert.deepEqual(Object.keys(config.services).sort(), ['app', 'caddy', 'clamav', 'postgres']);
  assert.equal(config.services.app.environment.NODE_ENV, 'production');
  assert.equal(config.services.app.environment.NEXT_PUBLIC_APP_URL, 'https://nexus-ci.test');
  assert.equal(config.services.app.environment.BUILD_SCANNER, 'clamav');
  assert.equal(config.services.app.environment.EMAIL_PROVIDER, 'disabled');
  assert.equal(config.services.app.build.target, 'runtime');
  for (const [name, service] of Object.entries(config.services)) {
    assert(!service.privileged && !service.container_name && !service.network_mode);
    assert.equal(service.restart, 'no');
    if (name !== 'caddy') assert.equal(service.ports?.length || 0, 0);
    for (const mount of service.volumes || []) {
      if (mount.type === 'volume') assert(config.volumes[mount.source]);
      else {
        assert.equal(name, 'caddy');
        assert.equal(mount.type, 'bind');
        assert.equal(mount.read_only, true);
        if (mount.target === '/etc/caddy/Caddyfile') assert.equal(mount.source, caddyFile);
        else {
          assert.equal(mount.target, '/etc/caddy/ProductionCaddyfile');
          assert(mount.source.endsWith('/deploy/Caddyfile'));
        }
      }
    }
  }
  for (const [name, volume] of Object.entries(config.volumes)) {
    assert(!volume.external && !volume.driver_opts);
    assert.equal(volume.name, `${project}_${name}`);
  }
  for (const [name, network] of Object.entries(config.networks)) {
    assert(!network.external && !network.driver_opts);
    assert.equal(network.name, `${project}_${name}`);
  }
  const ports = config.services.caddy.ports;
  assert.equal(ports.length, 2);
  assert.deepEqual(ports.map(p => [p.host_ip, String(p.published), p.target]).sort(),
    [['127.0.0.1', '8080', 80], ['127.0.0.1', '8443', 443]]);
}

export function assertInternalIssuer(config) {
  const policies = config.apps?.tls?.automation?.policies;
  assert(policies?.length, 'No explicit internal certificate policy');
  for (const policy of policies) {
    assert(policy.issuers?.length);
    assert(policy.issuers.every(issuer => issuer.module === 'internal'), 'Public ACME is forbidden in CI');
  }
}
