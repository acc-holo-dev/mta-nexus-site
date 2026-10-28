# Practical development contract

Owner request, 2026-10-28: broad development autonomy, low repeated context cost,
consistent product/code/commits, observable progress and two-agent collaboration after
preparation. [AGENTS](../../AGENTS.md) is the automatic entry point; this is the detailed
procedure. It updates the session mechanics of [the older handoff](11-AI-AGENT-HANDOFF.md),
not approved product decisions. The current no-publication instruction remains in force.

## Context and token cost

Start with the brief, selected queue task and domain map. Expand to relevant sections,
direct callers/callees, schema and tests. Read complete files only when needed to reason
about their behavior. The old index listed 16 introductory documents (about 411 KB at
the preparation baseline); that is not a compulsory context packet anymore.
Small entry files have byte ceilings checked by `pnpm agent:check`. Bytes are a measurable
proxy, not a promise of exact token savings. Never save tokens by omitting a required
invariant, review or test. Inspect summaries first and full failure logs when a check fails.
Do not copy logs, source files or the whole conversation into a handoff. Preserve links,
commands, counts and the reason for the next step. Do not add vector databases, agents'
memory services or orchestration frameworks without a demonstrated need.

## Autonomous task loop

1. Run `pnpm agent:brief` (or `node scripts/agent-context.mjs` before install).
2. Choose the first ready queue task whose dependencies are done, or continue the active
   task. Check the working tree. Read the relevant decisions and actual implementation.
3. Record owner, file scope, observable acceptance, commands and base SHA in the task.
   Break large work into finished slices. One integrating agent owns the queue.
4. Implement the smallest coherent behavior and appropriate tests. Add a dependency only
   after checking existing primitives and supported alternatives. Record material reversible
   choices as PROVISIONAL with reason and reversal path.
5. Have the reviewer inspect the diff, authorization/data boundaries and evidence.
   Fix reproduced issues; disagreement requires an example, test or documented invariant.
6. Run required combined checks, inspect the diff, update relevant docs/defect status,
   clean owned outputs and create one coherent local commit. Record the result and next step.
7. Continue to the next ready task within the active request. If all useful work requires
   an outside decision/access, summarize the exact blocker and preserve the handoff.

Keep WIP small: one implementation slice and one independent review. Each development
cycle must deliver observable product behavior or remove a demonstrated blocker. Do not
turn tidying into an endless prerequisite for feature work. Product work resumes through
BETA-01/FLOW-01 after security and documentation preparation; further cleanup belongs to
the same slice only when needed for its acceptance.

## Two agents, without shared-file collisions

After preparation, A is implementer/integrator; B is independent reviewer. B starts from
the task packet, relevant decisions and diff, not A's full conversation. B initially reads
only and reports severity, evidence and a concrete correction. B may implement an isolated
fix only after A assigns non-overlapping files. A alone owns the task board, index, staging,
commits, dependency lockfile and migration numbering. Changes to shared contracts are
serialized. Never have both agents run install, a build using the same output directory,
or database tests against the same mutable database simultaneously.

The board is a coordination record, not a lock or scheduler. Two separate chats must have
one designated integrator and explicit file handoff; they must not both claim an unassigned
task based on a stale board. No independent integrator available means sequential work.
An expired session is not an active owner: inspect its diff and handoff before resuming.
Never overwrite, reset or stage another agent's unexplained changes.

Task packet (fill it, keep it short):

```text
Task / base SHA:
User-visible result / acceptance:
Owner A / reviewer B:
Owned files / shared contracts:
Relevant decisions and source paths:
Required checks / evidence location:
Current diff / known issues:
Next concrete action:
```

Review is not a second full implementation. First inspect correctness, regressions,
security, failure/retry paths and missing tests; report style issues only when inconsistent
with the actual standards. A verifies the combined diff even when B's isolated tests pass.
If no second agent is available, disclose self-review; never invent independent approval.

## Code, UX and commit consistency

- Biome is the formatting/lint authority. Apply to touched supported files; avoid whole-tree
  reformatting. Use the pinned toolchain and frozen lockfile installs.
- Keep request parsing/HTTP adapters, services, repositories and shared domain boundaries.
  Reuse Zod schemas, error codes, request logging and private response policies. Test behavior
  rather than adding source-text assertions for product functionality.
- Reuse `@nexus/ui`, `globals.css` semantic tokens and the existing dictionary. Follow a
  neighboring maintained screen. Include loading, empty, unavailable, error and confirmed
  success states; preserve the exact user's command through uncertain retries.
- Permissions are server-side and current. RU/EN, light/dark, keyboard and narrow screens
  are part of UI acceptance. No mock production data or invented success.
- Commit title: `type(scope): outcome`, in English, imperative, preferably <=72 characters.
  Types: feat, fix, refactor, test, docs, chore, perf. Example:
  `fix(resources): preserve selection after an uncertain download`.
  Body: task ID, why, actual validation and material limits. Do not add `[skip ci]` merely
  to avoid checks. One logical slice; no unrelated generated files or blanket `git add .`.
  Local commit is distinct from push, deployment and environment publication.

## Verification and honest evidence

Use the existing `scripts/ci-policy.mjs` classification. The brief reports policy for local
changes, not the complete remote release diff. Focused checks during edits do not replace
required CI jobs. Infrastructure/security/dependency/migration changes require full acceptance.

| Change | Local evidence before review |
|---|---|
| Agent docs/tooling | `pnpm agent:check`, relevant Node tests and repository-policy Vitest |
| Logic/service/HTTP | Targeted behavioral/HTTP tests, typecheck and touched-file lint |
| Data/permissions/concurrency | Above plus relevant PostgreSQL tests in a disposable DB |
| UI journey | Relevant tests plus real browser behavior, locale/theme/mobile/keyboard |
| Dependencies/runtime | Frozen install, audit, code checks, DB, build and applicable browser/CI gates |

Use `pnpm check:code`, `pnpm test:database`, `pnpm build` and existing release scripts for
the required broader checks. Do not test mutations against production or a user's database.
In the prepared cloud host workflow, activate `/workspace/.cloud-setup/env.sh` if present.
For unit tests unset `NEXT_PUBLIC_APP_URL` and use `NODE_ENV=test`; app origin settings can
invalidate fixture requests. For build use production values documented in Dockerfile;
the local development origin is intentionally rejected. Full Compose commands belong to
the Compose workflow; do not assume a Compose app container exists for `dev:host`.

Evidence must state commit (or base SHA + diff identity for uncommitted work), command,
environment, result/counts and unrun items. Store large generated logs under ignored
`artifacts/`; keep the latest concise queue entry, not an accumulating diary. Repeat a check
when relevant inputs, environment or failures change. Record unsupported-tool warnings;
a successful process exit is insufficient if important work was skipped.

## Owner involvement and reusable prompt

The owner selects product direction and reviews outcomes. Routine implementation, local
tests, code style and reversible technical choices belong to agents. Respect existing
human decisions on production, destructive data operations, irreversible key changes,
real payments and financial/legal policy; prepare a concrete reviewable result before
asking. Never ask the owner to restate an already recorded decision.

The owner's final update should fit a few paragraphs: delivered outcome, checks, unresolved
risk, next step. No invented readiness percentage, completion date or token-saving claim.
Work runs during an active session; continuous unattended operation requires a separately
configured runner. Repository instructions alone cannot keep two agents running.

Reusable owner request:

> Continue MTA NEXUS using AGENTS.md. Run the brief and choose the next ready task or
> resume the active task. Deliver one coherent useful slice, with consistent code/UX,
> appropriate checks and a concise handoff. After preparation use A for implementation
> and integration and B for independent review; serialize shared files and Git operations.
> Make safe reversible decisions autonomously and record material reasons. Respect current
> publication and production boundaries. Report outcome, evidence, remaining blocker and
> next step; do not ask me to manage routine technical choices.
