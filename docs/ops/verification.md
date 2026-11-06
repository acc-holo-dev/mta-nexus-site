# Verification, CI scopes and focused checks

**Статус:** living · ops module (D4).  
**Канон:** якорь [`## 2. Verification`](../OPERATIONS.md#2-verification) в OPERATIONS.

## 2. Verification

Run the appropriate scope against a prepared environment. PostgreSQL tests need a disposable database; do not run the full suite against the development database.

```bash
pnpm install --frozen-lockfile
pnpm check:code
pnpm docs:check
pnpm test:isolated  # requires the running Docker development stack
pnpm build
```

`test:isolated` owns a uniquely named database and removes it after success or failure. It never recreates a shared database. It requires the default local Docker context and refuses `DOCKER_HOST` or `DOCKER_CONTEXT` overrides before creating the database. For a host-only setup, create a separate database, apply migrations there and set its `DATABASE_URL` before `pnpm test:database`. Product-specific moderation and verification contracts are indexed in the [domain map](../handbook/15-AI-CONTEXT-INDEX.md).

### Test and CI scopes

- `pnpm check:code`: formatting, lint, types, package boundaries, unused code, unit and tooling checks; no Docker or PostgreSQL required.
- `pnpm test:unit`: isolated unit/mock suites, at most four parallel workers; no database required. Prints the normal reporter and writes timings/results to ignored `artifacts/unit-tests.json`. Run **without** `NEXT_PUBLIC_APP_URL` (same as the CI `unit` job); unit CSRF fixtures use `Origin: http://nexus.test` and correctly fail closed when APP_URL is `http://localhost:3000`.
- `pnpm test:database`: real DB/integration suites, sequential files against a disposable PostgreSQL database. Run **with** `NEXT_PUBLIC_APP_URL` (same as the CI `verify` job).
- `pnpm test:tooling`: standalone Node suites. Compose validators that require rendered JSON remain owned by their infrastructure harnesses.
- `pnpm test`: both Vitest projects in one process/env. Prefer CI-aligned runners for acceptance: `node scripts/run-ci-aligned-vitest.mjs` (used by `pnpm release:verify` and `compose.verify.yaml` / `NEXUS_LOCAL_VERIFY=true` local disposable verify) runs unit without APP_URL then database with APP_URL. `pnpm test:isolated` runs the same split directly in its owned database. Do not weaken CSRF checks to make a combined `pnpm test` + APP_URL green.
- CI-aligned and release verification require `NEXUS_DISPOSABLE_DATABASE=1` and an explicit PostgreSQL `DATABASE_URL` without query/fragment: host must be loopback or Compose `postgres`, and database name must end in `_test`/`_verify`, or be an owned `nexus_test_<uuid>` / `nexus_focus_<timestamp>_<random>` name. Release verification blocks both migration and test gates if preflight fails. The acknowledgement, host and name do not prove that a database contains no valuable data: the operator must ensure the target is disposable before setting them.
- Disposable local Docker verify: `NEXUS_LOCAL_VERIFY=true bash scripts/check-local-verification.sh` (or the `.ps1` twin) builds `compose.verify.yaml`, migrates a fresh DB, typechecks, runs CI-aligned Vitest, then a production-shaped `pnpm build`. It is a developer fallback, not a GitHub Actions workflow; CI still runs `check:code` and `test:database` as separate jobs and does **not** invoke `release:verify`.

CI chooses a scope from the changed-file set (`scripts/ci-policy.mjs`). Unknown or
mixed paths never narrow the gate; they stay on `fast_ci` or escalate to
`full_acceptance`. Local commands stay aligned with those scopes.

Workspace install jobs (`unit`, `verify`, `mail-worker`) must keep
`pnpm/action-setup` **before** `actions/setup-node` with `cache: pnpm`, then
`pnpm install --frozen-lockfile`. Jobs without a workspace install must not set
`cache: pnpm`. This order is asserted by `scripts/tests/ci-hardening.node-test.mjs`.
Do not widen path scopes to “make CI green.” After `pnpm test:unit`, optional
`node scripts/summarize-unit-timings.mjs` ranks slow files from
`artifacts/unit-tests.json` (gitignored). Measured host timings live in
[PROBLEMS](../PROBLEMS.md#проверки-и-сопровождение); cache contract summary:
[PROJECT-MAP](../PROJECT-MAP.md#ci-install-cache-проверено).

Pull requests use the following change-based scopes; the local commands remain aligned with them:

| Scope             | When                                                                                                                                                          | CI jobs                                               | Local analogue                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `documentation`   | Markdown-only (`README.md`, `docs/**/*.md`)                                                                                                                   | `plan` (doc links)                                    | `node scripts/check-doc-links.mjs`                                                                                      |
| `unit_ci`         | Only `packages/ui/**` and/or `apps/web/src/components/**` (plus markdown)                                                                                     | `plan`, `unit`                                        | `pnpm check:code`                                                                                                       |
| `fast_ci`         | Other application code that is not infrastructure                                                                                                             | `plan`, `unit`, `verify`, `image`, `smoke`            | `pnpm check:code` then disposable `pnpm test:database` (or `node scripts/run-ci-aligned-vitest.mjs` / `compose.verify`) |
| `full_acceptance` | Migrations, Compose/Docker, workflows, lockfiles, security/storage/config, selected trust-boundary repositories, release tags, or workflow_dispatch with full | All CI jobs including browser and production rehearse | `pnpm release:verify` (CI-aligned Vitest) / `test:isolated` / full acceptance                                           |

Every push to `main`, release tags (`v*`) and explicit full workflow dispatch run `full_acceptance`.
Main pushes can cancel an earlier run, so even a documentation-only successor must
verify the exact new commit rather than rely on its cancelled predecessor.
The CI unit job and host development use the same `check:code` command. It uses
the pinned pnpm's [native script selection](https://pnpm.io/cli/run#running-multiple-scripts),
with an anchored selector for exactly seven scripts. `--sequential` bounds memory;
`--no-bail` lets independent checks finish after an earlier failure and returns a
nonzero result if any check failed. The selected checks are independent of order. Unit
test files still run with four Vitest workers. CI preserves the unit JSON even
when a different check fails; database/build/browser acceptance keep their own jobs.
No additional task runner is installed.

`scripts/test-projects.mjs` uses the existing pinned SWC parser to inspect source
syntax without executing modules. It follows executable imports/re-exports,
CommonJS and TypeScript import-equals edges, plus calls inside template expressions.
Explicit type-only declarations and TypeScript import queries are erased; inline
type specifiers remain conservative because their module can retain side effects.
Zero-argument arrow factories in hoisted `vi.mock` calls cut a mocked import edge,
including Vitest's typed `vi.mock(import("..."), factory)` syntax. Partial/automatic
and runtime mocks, `importActual` and unmock calls retain live edges. Unknown
dynamic targets and unresolved local/workspace imports remain in the DB project;
syntax errors stop classification with the source path. This is a conservative
repository policy, not a whole-program evaluator of arbitrary aliases or control flow.
See [SWC parsing APIs](https://swc.rs/docs/usage/core#parse)
and [Vitest mock semantics](https://vitest.dev/api/vi#vi-mock).

### Automated browser accessibility

All five browser-tool installations in the workflows use
`scripts/browser-toolchain.mjs`. This is the single place to update their
pinned package versions:

| Profile | Tools                                               | Used by                               |
| ------- | --------------------------------------------------- | ------------------------------------- |
| `basic` | Playwright                                          | DEV origin/hydration verification     |
| `a11y`  | Playwright, axe Playwright integration and axe-core | Production smoke and Resource browser |
| `agent` | Playwright and agent-browser                        | Account and Directory browser         |

The installer receives an absolute tool directory, invokes npm directly, and
preserves a failed installation's exit status. Each job still uses its own
temporary tool directory and Chromium installation. The application dependency
graph is unchanged by these profiles. Direct package versions are pinned;
browser-tool transitive dependencies retain npm's normal resolution behavior.

The Chromium acceptance uses `@axe-core/playwright` 4.13.0 and
`axe-core` 4.13.0. Both are pinned in the isolated browser-tools installations for
the smoke and resource-browser jobs; they are not application dependencies.

| Contour                  | Scanned states                                                                                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Production browser smoke | Login, registration and password recovery in RU/EN, light desktop and dark mobile themes; authenticated workspace after registration.                                                      |
| Resource browser         | Open notification and mobile More dialogs in RU/EN; login error, recovery success and authenticated Settings, Security, Support, resource publishing and server claim at 320px and 1280px. |

`scripts/axe-accessibility.mjs` scans the full rendered state after each test's
readiness assertions. It selects WCAG 2 A/AA, 2.1 A/AA and 2.2 AA rule tags and
fails on every returned violation, including contrast. There are no rule disables
or excluded page regions. Existing keyboard, focus, reflow and ARIA-reference
checks remain in the same scenarios.

Every completed scan writes a JSON diagnostic under the job report's `axe/`
directory and attaches it to Playwright. Reports retain rule IDs, impacts, help
links and element selectors, without raw HTML or form values. Incomplete checks
are recorded for review separately from confirmed violations. Passing scans are
retained even though general Playwright output is preserved only for failures.
These checks cover automatically detectable issues in the tested states; keyboard
and assistive-technology assessments remain necessary.

The standalone gate tests verify that a violation blocks acceptance after its
report is saved, incomplete findings stay visible, and engine errors propagate.
They use a browser-adapter fixture and do not claim a real DOM scan. Current
browser execution/hosted-runner limitations are tracked in [PROBLEMS](../PROBLEMS.md).
Integration follows the [official Playwright accessibility guide](https://playwright.dev/docs/accessibility-testing)
and [axe Playwright API](https://github.com/dequelabs/axe-core-npm/tree/v4.13.0/packages/playwright).

### Property-based checks

`fast-check` 4.10.2 is a root development dependency and runs through the existing
Vitest unit project. `pnpm test:properties` executes four trusted-proxy/IP
properties, each with 1000 generated cases: mismatched Unicode markers must not
throw, missing/untrusted markers must ignore forwarded IPs, a trusted real IPv4/IPv6
address takes precedence, and an invalid first forwarded hop must not be skipped.

The default seed is `20261009`, keeping CI repeatable. Use another signed 32-bit
seed to explore additional inputs:

```bash
FC_SEED=12345 pnpm test:properties
```

Fast-check reports its seed and shrinks a failure to a smaller counterexample.
The first adoption caught a UTF-8 length error in proxy-marker comparison;
the exact Latin-1 regression is also covered using real Fetch Headers. Invalid
markers return `unknown` before `timingSafeEqual` can throw, while correct
markers still use timing-safe byte comparison. This is a bounded property suite,
not an exhaustive proof of all request handling.
See the [official fast-check building blocks](https://fast-check.dev/docs/core-blocks/)
and [Node timingSafeEqual contract](https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b).

### Code analysis and focused checks

Use `pnpm analyze:architecture` and `pnpm analyze:unused` for dependency boundaries and unused code. Dependency-cruiser currently warns about TypeScript 7 compatibility; do not treat its result as complete without resolving that limitation.

`pnpm test:focus <test-file> ...` runs only named Vitest or `.node-test.mjs` files and classifies only the selected Vitest import graphs. Database tests require applied migrations and the same disposable database preflight (acknowledgement, URL host and name) as CI-aligned verification above. Unit-only tests do not require a database. When Compose Postgres is unpublished on the host (`compose.yaml`), use `pnpm test:focus:compose <tests/...integration.test.ts>` to create a disposable database on the Compose network, migrate it, run the focused files, and drop the database. This helper requires the default local Docker context without `DOCKER_HOST`/`DOCKER_CONTEXT` overrides and uses only the documented `nexus-local` project; it refuses another `COMPOSE_PROJECT_NAME`. Existing grouped commands include `pnpm test:directory`, `pnpm test:resource`, `pnpm test:scanner`, `pnpm test:catalog` and `pnpm test:reports`. These focused checks do not replace full CI or release acceptance.

`pnpm ci:diagnose --run-id <id>` reads one GitHub Actions run and its annotations. It may require an appropriate read-only GitHub credential. A workflow with zero executed steps is not a successful test.
