# Эксплуатация — указатель модулей (D4)

**Статус:** living · навигация.  
**Канонический путь runbook для scripts/CI:** [`docs/OPERATIONS.md`](../OPERATIONS.md) — **не удалять и не переименовывать** без согласованного переноса consumers.

Этот каталог — карта разреза монолита. Пока текст живёт в `OPERATIONS.md`; будущие `docs/ops/*.md` подключаются только вместе с обновлением:

- `scripts/observability-evidence-lib.mjs`
- `scripts/tests/*operator*` / release-evidence suites
- `tests/dev-startup-contract.test.ts`
- `tests/mainline-repository-policy.test.ts`

## Карта разделов → якоря в OPERATIONS

| Модуль (план) | Тема | Якорь / раздел сейчас |
| ------------- | ---- | --------------------- |
| `dev-startup` | DEV Compose, overlays, mail | [§1 Supported DEV startup](../OPERATIONS.md#1-supported-dev-startup) |
| `verification` | Test/CI scopes, browser/axe | [§2 Verification](../OPERATIONS.md#2-verification) |
| `production-boundary` | Overlay matrix, digests, migrations | [§3 Production boundary](../OPERATIONS.md#3-production-boundary) |
| `inbox-recovery` | Report/support/verification/push/discussion/build-incident | [Recovering report inbox…](../OPERATIONS.md#recovering-report-inbox-delivery) и соседние |
| `backup-recovery` | Backup/restore, maintenance | [§4 Backup and recovery](../OPERATIONS.md#4-backup-and-recovery) |
| `resource-safety` | Scanner / integrity / quarantine ops | [§5 Resource safety](../OPERATIONS.md#5-resource-safety-operations) |
| `release` | Branch/release, GHCR, beta evidence | [§6 Branch and release](../OPERATIONS.md#6-branch-and-release-operations) |
| `workers` | Push/mail workers, limits | [workers.md](workers.md) · stub [Worker liveness…](../OPERATIONS.md#worker-liveness-vs-progress) |

## Правила переноса

1. Сначала вынести раздел в `docs/ops/<module>.md` **и** оставить в `OPERATIONS.md` короткий stub со **стабильным якорем** (redirect + обязательные markers).
2. Прогнать operator/evidence tests + `pnpm docs:check`.
3. Только после зелёных consumers — убрать дублирующий полный текст из монолита.
4. Version string `1.2.0-beta.3` и marker strings, которые читают suites, сохранять в каноническом пути или явно обновить тесты в том же PR.

Стиль — [DOCS-STYLE](../DOCS-STYLE.md). IA — [PROJECT-MAP](../PROJECT-MAP.md).
