# MTA NEXUS: agent entry point

Build a coherent MTA community product. Complete one useful, verifiable task at a time.

## Start with a small context

1. Run `node scripts/agent-context.mjs` from the repository root. It is read-only,
   needs no installed dependencies and reports HEAD, changes and task order.
2. Read the selected task in [the queue](docs/handbook/59-DEVELOPMENT-QUEUE.md).
   Use [the context map](docs/handbook/15-AI-CONTEXT-INDEX.md) to find only relevant
   code, tests and handbook sections. Search with `rg` before opening large files.
3. Check current changes and recent commits in the affected area. Preserve others'
   work. Use this checkout; cloud tasks are isolated. Create no worktree unless asked.
4. Before editing, state the outcome, affected files and verification. Read more when
   authorization, state transitions, shared contracts or evidence are unclear.

Do not read the whole handbook, README or PROBLEMS on every task. Do not reload an
unchanged file already read in this session. Summaries are navigation aids: verify
behavior in code. The initial context budget is not a limit on necessary investigation.

## Authority and current product

Current user instructions govern the task. For product intent, use owner-confirmed
decisions and [source precedence](docs/handbook/58-SOURCE-OF-TRUTH-AND-REPO-HANDOFF.md).
Code, migrations and executed checks establish current behavior. Label target and
provisional behavior honestly; legacy material is historical evidence.

Closed beta currently supports free resources. Paid commerce/DRM are approved targets,
not enabled production features. Preserve these invariants:

- Downloadable builds are published, clean and have scanner identity/timestamp.
- Check current session, ownership and organization authority; keep private data private.
- Critical writes and their audit are transactional; retries preserve intended commands.
- Migrations are forward-only after sharing; use disposable databases for tests.
- RU/EN, keyboard access, responsive UI and truthful server-confirmed results are required.

Choose reversible development details and next tasks autonomously. Record material
provisional decisions with their reason. Ask only for missing decisions that block work
or cross an existing production, destructive-data, real-money or legal boundary.
The owner's current instruction prohibits publication: do not push, deploy or publish
environment changes until that instruction is changed. Local coherent commits are allowed.

## One style, one finished slice

Use Biome from `biome.json` on touched files. Follow neighboring code and existing
request adapters, validation schemas, services, repositories, `@nexus/ui`, semantic
theme tokens and RU/EN dictionary. Do not create a second pattern for the same behavior.
Keep loading/empty/error/success, permission failures and uncertain retries consistent.
Avoid unrelated formatting, new dependencies without a need, speculative frameworks
and parallel implementations. See [workflow](docs/handbook/60-AGENT-WORKFLOW.md) for detail.

For commits use `type(scope): outcome` in English: feat, fix, refactor, test, docs,
chore or perf. One logical change; task ID and actual validation in the body.
Only the integrating agent stages/commits. Never use blanket staging in a shared tree.

## Verify and hand off

Run focused behavioral tests during development, then the required CI gates for the
combined change. The brief's CI scope is advisory and never authorizes skipping gates.
Do not repeat expensive unchanged checks without a reason. Never weaken assertions to
make a test pass or treat skipped/unrun checks as passed. `pnpm agent:check` validates
the short context and handbook inventory; `pnpm agent:manifest` refreshes its hashes.

Keep the queue short: outcome, owner, dependencies, next step, validation, blockers.
PROBLEMS remains the only defect registry; link to it rather than duplicate it.
Record evidence against the tested commit or base+diff; do not inherit a previous pass
after relevant changes. Clear generated debris you created, preserving pre-existing files.
Final report: outcome, checks, remaining risk/blocker and next task.

Two-agent execution starts after preparation. Then one agent owns implementation and
integration; the other reviews the diff and behavioral evidence. Follow the workflow's
ownership and handoff rules. Agents work only while their execution sessions run;
these files do not create a background scheduler.
