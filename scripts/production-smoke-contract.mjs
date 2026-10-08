import assert from 'node:assert/strict';

export const PRODUCTION_UPLOAD_ENVELOPE_BYTES = 65 * 1024 * 1024;

function durationSeconds(value) {
  if (typeof value !== "string") return Number.NaN;
  const match = value.match(/^(?:(\d+)m)?(?:(\d+)s)?$/u);
  if (!match || (!match[1] && !match[2])) return Number.NaN;
  return Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0);
}

export function assertProductionUploadBodyLimit(source) {
  const match = source.match(/request_body\s*\{[\s\S]*?max_size\s+(\d+)[\s\S]*?\}/u);
  assert(match, 'Production Caddyfile must declare a request_body max_size');
  assert.equal(
    Number(match[1]),
    PRODUCTION_UPLOAD_ENVELOPE_BYTES,
    'Production proxy body limit must equal the 65 MiB build-upload envelope',
  );
  const declared = source.match(/int\(\{header\.Content-Length\}\) > (\d+)/u);
  assert(declared, 'Production proxy must reject declared oversized bodies before upstream handling');
  assert.equal(Number(declared[1]), PRODUCTION_UPLOAD_ENVELOPE_BYTES, "Declared length limit must equal the 65 MiB build-upload envelope");
  assert.match(source, /respond @oversized_body "Request body too large" 413/u);

}

// Preserve every production proxy directive; change only the test CA policy.
export function localCertificateConfig(source) {
  assert(source.startsWith('{\n'), 'Review the Caddy global block before changing this fixture');
  assert(!/\b(local_certs|acme_ca|tls)\b/.test(source), 'Explicit TLS settings require fixture review');
  return source.replace('{\n', '{\n  local_certs\n  skip_install_trust\n');
}

export function assertIsolatedProduction(config, project, caddyFile) {
  assert.match(project, /^nexus-prod-ci-[a-f0-9-]{36}$/);
  assert.equal(config.name, project);
  assert.deepEqual(
    Object.keys(config.services).sort(),
    ['app', 'caddy', 'clamav', 'postgres', 'push-worker'],
  );
  assert.equal(config.services.app.environment.NODE_ENV, 'production');
  assert.equal(config.services.app.environment.NEXT_PUBLIC_APP_URL, 'https://nexus-ci.test');
  assert.equal(config.services.app.environment.BUILD_SCANNER, 'clamav');
  assert.equal(config.services.app.environment.EMAIL_PROVIDER, 'disabled');
  assert.equal(config.services.app.build.target, 'runtime');
  const pushWorker = config.services['push-worker'];
  assert.equal(pushWorker.image, config.services.app.image);
  assert.equal(pushWorker.user, 'node');
  assert.equal(pushWorker.read_only, true);
  assert.equal(pushWorker.init, true);
  assert.deepEqual(pushWorker.cap_drop, ['ALL']);
  assert.deepEqual(pushWorker.security_opt, ['no-new-privileges:true']);
  assert.equal(pushWorker.pids_limit, 128);
  assert.equal(pushWorker.stop_signal, 'SIGTERM');
  assert.equal(
    durationSeconds(pushWorker.stop_grace_period),
    75,
    'push-worker must keep a 75-second graceful stop budget',
  );
  assert(pushWorker.tmpfs?.some((entry) => String(entry).startsWith('/tmp:')));
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
