# Development queue

Execution order, not a second defect register. Owner: integrating agent.
Read only the selected task and its dependencies. Product decisions remain in
[the register](13-DECISION-REGISTER.md); defects remain in [PROBLEMS](../PROBLEMS.md).
Statuses: ready, active, review, blocked, done. At most one implementation task active.
After a task closes, choose the next ready task; a blocked task must name the missing
prerequisite and permit independent work to continue. Keep only the latest detailed completion; retain done rows while dependencies reference them.

## Order

| ID | State | Owner | Depends on | Outcome |
|---|---|---|---|---|
| PREP-01 | done | primary | — | Small context, shared workflow and executable checks |
| SEC-01 | ready | unassigned | PREP-01 | Resolve dependency advisories with verified updates |
| DOC-01 | ready | unassigned | PREP-01 | Current defect index and accessible documentation |
| BETA-01 | ready | unassigned | SEC-01, DOC-01 | One explicit beta acceptance contract |
| FLOW-01 | ready | unassigned | BETA-01 | Accepted RU/EN acquisition and publishing journey |
| RELEASE-01 | blocked | unassigned | FLOW-01 | Evidence for a candidate on target infrastructure |

## PREP-01

Accept: root agent entry, bounded brief, domain map, two-agent contract, code/UX/commit
standards, context checks in CI and valid handbook manifest. Validate the tooling and
existing documentation/CI policy tests. Finish preparation before starting a second agent.
Completed: context/workflow tooling and CI check validated; self-review only because
the second agent starts after preparation. Publication remains off; next eligible task is SEC-01.

## SEC-01

Entry: reproduce the dependency audit and read relevant [security](04-TRUST-SAFETY-SECURITY.md)
and [operations](../OPERATIONS.md) sections. Earlier audit findings are leads, not current proof.
Scope: affected package manifests, lockfile and necessary compatibility fixes; small groups.
Accept: each advisory is fixed or has a specific reachability assessment and tracked follow-up;
frozen install, code, database, build and applicable browser/CI gates pass. Explain remaining
risk, including development tooling. Reconcile Node support and TypeScript analysis compatibility.
Do not replace the stack or upgrade everything solely to get the newest version.
Next: re-run audit, identify first compatible security update group, record it in PROBLEMS.

## DOC-01

Entry: headings and relevant entries in [PROBLEMS](../PROBLEMS.md), [Operations](../OPERATIONS.md),
and [source precedence](58-SOURCE-OF-TRUTH-AND-REPO-HANDOFF.md).
Accept: concise active defect index with stable IDs, evidence/date/scope/next step; historical
evidence clearly marked without losing it; relative file links and anchors checked; current
claims reconciled against code. Retain the three root operational documents and handbook.
Next: distinguish a demonstrable defect from old environment limits and unrun acceptance.

## BETA-01

Entry: [launch decisions](32-LAUNCH-ONBOARDING-AND-PRODUCTION-GATES.md) and relevant screen specs.
Accept: finite scope, user journeys, explicit exclusions and measurable release gates, tied
to existing owner decisions. Document safe reversible choices; ask only about material conflicts.
Next: define a candidate free-beta journey and map each gate to an executable check.

## FLOW-01

Scope: one vertical slice of the accepted beta journey at a time; fix observed failures and
deliver usable features. Use [the domain map](15-AI-CONTEXT-INDEX.md) and existing UI patterns.
Accept: guest discovery → account → free acquisition → verified download; publisher upload →
scan → moderator decision → authorized delivery. Review permissions, retries, errors, RU/EN,
mobile and keyboard behavior. Preserve invariants; only claim exercised scenarios.
Next: run the existing browser acceptance against the candidate and turn failures into tasks.

## RELEASE-01

Blocked on: target infrastructure/access and explicit publication authorization, in addition
to implementation dependencies. Independent work: prepare exact-commit CI evidence, recovery
rehearsal, runbook and local acceptance. Use existing release tools in [Operations](../OPERATIONS.md).
Accept: required gates and backup/restore evidence for the exact candidate, documented residual
limitations, then an authorized production decision. A development test pass is not release approval.

## Latest completion / handoff

PREP-01, 2026-10-28, based on source `dce34330`; evidence applies to the preparation
commit containing this entry. Passed: 323 tooling tests, 4 repository-policy tests,
TypeScript, Knip, new-script Biome lint, context/manifest check and diff whitespace check.
The brief was exercised on the real checkout. Eight pre-existing manifest hash mismatches
were refreshed. No application behavior/dependencies changed; full remote CI, browser,
production and release acceptance were not run for this preparation change.
Self-review was used; no feature work has been delegated. Next: SEC-01 dependency audit.
