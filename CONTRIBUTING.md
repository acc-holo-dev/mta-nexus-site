# Contributing

Minimal mechanics for contributing to this repository. For contracts, boundaries, task
selection and the result format, read [docs/AGENT.md](docs/AGENT.md) first, then
[AGENTS.md](AGENTS.md).

## Branch and commits

- Work on the canonical branch `main`. Create a feature/patch directly on `main` unless an owner
  request says otherwise.
- Commit message format: `type(scope): result` — a short imperative summary of the achieved
  behaviour, in English. Examples: `docs(project-map): correct compose and handbook pointers`,
  `fix(notifications): retry fanout admission on exhausted attempts`.
- One consolidated commit per agreed piece of work; the Git history and CI results are the record
  of what happened. Do **not** keep parallel hand-off journals or multiple manual backlog copies.

## Local code-health gates

Run these before proposing a change:

| Command                                | Purpose                                                                                         |
| -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `pnpm check:code`                      | Canonical host code-health: format, lint, types, boundaries, unused, unit + tooling (no Docker) |
| `pnpm docs:check`                      | Local Markdown links and heading anchors                                                        |
| `pnpm test:focus path/to/file.test.ts` | Narrow targeted Vitest / `.node-test.mjs` run                                                   |
| `pnpm test:isolated`                   | Full Vitest against a disposable DB (Docker stack)                                              |

`pnpm check:code` is the single local code-health gate. DB tests need `DATABASE_URL` on a
disposable database (see [docs/OPERATIONS.md](docs/OPERATIONS.md)).

## Pull requests

If a PR is proposed, keep it small and focused on one behaviour. Do **not** change GitHub
repository settings, branch protection, or permissions: those require an explicit owner order
per [docs/CURRENT-STATE.md](docs/CURRENT-STATE.md). Merging, pushing and production deploy also
require explicit owner instruction — a passing CI gate is not permission to push or release.
Do not claim "PASS" or production readiness without a real, verified status on the exact SHA.

## Tracker and documentation

The single source of truth for tasks is [`planning/tasks.json`](planning/tasks.json)
([contract](planning/TRACKER.md)). Generated views (`docs/ROADMAP.md`, `docs/TASKS.md`,
`docs/TRACEABILITY.md`) are regenerated from it — do not hand-edit them as canonical state.
