# Workers: liveness, VAPID, container hardening

**Статус:** living · ops module (D4 extract).  
**Канон для consumers:** якоря остаются в [`docs/OPERATIONS.md`](../OPERATIONS.md); этот файл — полный текст модуля.

См. также указатель [README](README.md).

## Worker liveness vs progress

Production delivery workers distinguish process heartbeat from dispatcher progress.
A fresh health-file heartbeat is not sufficient if the main dispatch loop has
stopped completing batches. Web Push uses a 180-second progress watchdog.
Account mail uses a minimum 180-second watchdog that scales with configured
batch size and SMTP timeout. If progress exceeds that budget, the worker exits
non-zero so the container restart policy can recover it; durable leases/outbox
rows remain authoritative and are reclaimed after expiry.

## Web Push VAPID triplet generation

Configure all three `WEB_PUSH_VAPID_*` values together or leave them empty so the
push worker stays healthy-idle. For a new environment (not routine maintenance
rotation), generate a matching P-256 pair accepted by `@nexus/config`:

```bash
node scripts/generate-web-push-vapid.mjs
```

Pass a real operator contact as the optional argument when the placeholder
`mailto:ops@example.invalid` subject is not appropriate:

```bash
node scripts/generate-web-push-vapid.mjs 'mailto:ops@your-domain.example'
```

Copy the printed lines into the protected environment file only; never commit the
private key or treat generator output as beta/release evidence.

## Push worker container hardening

The production Web Push worker uses the same approved runtime image as the web
application but runs as an isolated non-root service with a read-only root
filesystem, a small noexec/nosuid/nodev tmpfs for health state, all Linux
capabilities dropped, no-new-privileges, a bounded PID limit, SIGTERM and a
75-second graceful-stop window. CI production smoke renders the real Compose
configuration, pins the push worker to the exact prebuilt commit image, disables
restart only for the disposable test project, and asserts these runtime
isolation properties before acceptance continues.

## Worker container limits

OPS-15 aligns production delivery workers to the same writable-path profile
without changing batch/retry/SIGTERM delivery semantics:

| Service                          | Writable paths                 | Notes                                                                 |
| -------------------------------- | ------------------------------ | --------------------------------------------------------------------- |
| `push-worker`                    | tmpfs `/tmp` (`HOME`/`TMPDIR`) | Health + queue probes under `/tmp`                                    |
| `license-worker`                 | tmpfs `/tmp` (`HOME`/`TMPDIR`) | Heartbeat JSON under `/tmp`; same read_only/cap_drop/pids/SIGTERM/75s |
| `resource-release-worker`        | tmpfs `/tmp` (`HOME`/`TMPDIR`) | Same profile; durable queue/cursors stay in PostgreSQL                |
| `mail-worker` (optional overlay) | tmpfs `/tmp` (`HOME`/`TMPDIR`) | Already matched this profile                                          |

Do not extend `read_only` to `app`/PostgreSQL without a separate writable-path
analysis. Structural Compose tests are necessary but not sufficient: rehearse a
real batch, restart/stop, and health progress under the disposable production
Compose acceptance before treating constraints as launch-proven.
