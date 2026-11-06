# Эксплуатация — указатель модулей (D4)

**Статус:** living · навигация.  
**Канонический путь runbook для scripts/CI:** [`docs/OPERATIONS.md`](../OPERATIONS.md) — **не удалять и не переименовывать** без согласованного переноса consumers.

Модули уже вынесены; `OPERATIONS.md` держит stubs + consumer markers. Дальнейшие переносы (например `dev-startup`) — только вместе с обновлением:

- `scripts/observability-evidence-lib.mjs`
- `scripts/tests/*operator*` / release-evidence suites
- `tests/dev-startup-contract.test.ts`
- `tests/mainline-repository-policy.test.ts`

## Карта разделов → якоря в OPERATIONS

| Модуль (план)         | Тема                                | Якорь / раздел сейчас                            |
| --------------------- | ----------------------------------- | ------------------------------------------------ |
| `dev-startup`         | DEV Compose, mail                   | [dev-startup.md](dev-startup.md)                 |
| `verification`        | Test/CI scopes, browser/axe         | [verification.md](verification.md)               |
| `production-boundary` | Overlay matrix, migrations          | [production-boundary.md](production-boundary.md) |
| `inbox-recovery`      | Notification delivery recovery      | [inbox-recovery.md](inbox-recovery.md)           |
| `backup-recovery`     | Backup/restore, maintenance         | [backup-recovery.md](backup-recovery.md)         |
| `resource-safety`     | Build safety / admin storage        | [resource-safety.md](resource-safety.md)         |
| `release`             | Branch/release, GHCR, beta evidence | [release.md](release.md)                         |
| `workers`             | Push/mail workers, limits           | [workers.md](workers.md)                         |

## Правила переноса

1. Сначала вынести раздел в `docs/ops/<module>.md` **и** оставить в `OPERATIONS.md` короткий stub со **стабильным якорем** (redirect + обязательные markers).
2. Прогнать operator/evidence tests + `pnpm docs:check`.
3. Только после зелёных consumers — убрать дублирующий полный текст из монолита.
4. Version string `1.2.0-beta.3` и marker strings, которые читают suites, сохранять в каноническом пути или явно обновить тесты в том же PR.

Стиль — [DOCS-STYLE](../DOCS-STYLE.md). IA — [PROJECT-MAP](../PROJECT-MAP.md).
