# Recovering discussion inbox delivery

Run from the repository with the target database environment loaded:

```sh
pnpm --filter @nexus/web notifications:replay /durable/checkpoints/discussions.json 2026-10-12T00:00:00.000000Z 2026-10-12T06:00:00.000000Z 100
```

The directory must exist. Both inclusive boundaries use UTC with six fractional digits. Choose a window covering the interrupted comment requests. Re-run the same command and checkpoint until `completed` is true. Each invocation handles at most the requested number of comments (1–10000); database pages contain at most 50 rows. The tool does not print comment text or recipient identities.

The checkpoint stores the fixed window and the last fully delivered comment's exact timestamp and ID. It advances only when the existing dispatcher reports no inbox failures. A failed event stops the run with exit status 1; a process interruption or checkpoint-write failure repeats that event. Existing inbox idempotency prevents duplicates, and delivery rechecks publication availability, subscriptions and preferences. Deleted/unavailable targets are skipped using the existing dispatcher policy. This is recovery under current eligibility, not a historical reconstruction of unsubscribed readers.

Checkpoint writes flush a temporary file before atomic replacement. Keep the checkpoint directory on durable local storage and use a separate checkpoint for each database/window. Exclusive `.lock` creation prevents concurrent runs using the same checkpoint. A hard termination can leave that lock; remove it only after verifying the previous process has stopped. Do not remove the checkpoint to retry an individual failure.

## Background recovery

Append `--worker` after the comment budget to automatically drain the fixed window:

```sh
pnpm --filter @nexus/web notifications:replay /durable/checkpoints/discussions.json 2026-10-12T00:00:00.000000Z 2026-10-12T06:00:00.000000Z 100 --worker
```

The budget applies to each pass. Successful incomplete passes wait one second; failed delivery or database/file errors retry with exponential delays from one second to one minute. A successful pass resets backoff. The worker exits once the fixed window completes. `SIGTERM`/`SIGINT` interrupt its delay and stop between comments after saving the current successful event. Allow enough shutdown time for the active comment's full audience; a forced kill requires stale-lock inspection as described above. Monitor repeated generic failure logs: a persistent failed event intentionally blocks later comments instead of silently losing recipients. Launch from a service manager with the database environment and durable checkpoint directory; do not run duplicate workers for the same window.

This tool recovers inbox fan-out; it does not discover new windows or introduce a transactional fan-out outbox. Existing persisted push jobs remain handled by the push worker. Push queue degradation is reported by the normal dispatcher but does not block this inbox checkpoint; replaying duplicate inbox records does not guarantee repair of missing push jobs. Continuous database-backed recovery, leases and enqueueing within comment persistence remain follow-up work coordinated with the schema owner.
