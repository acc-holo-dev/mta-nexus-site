# Качество и CI: scopes, время, когда что бежит

**verified_at:** 16 ноября 2026 (Europe/Moscow).  
**Источник правил:** [`scripts/ci-policy.mjs`](../../scripts/ci-policy.mjs).  
**Ветки:** работа на `dev`, линия выпуска — PR `dev` → `main` после зелёного `CI result`.

Этот документ самодостаточен: объясняет модель проверки, ожидаемое время и действия при ошибке. Операторские команды Docker/markers — в [`docs/OPERATIONS.md`](../OPERATIONS.md).

## Зачем четыре уровня

Цель — **быстрый сигнал на обычных правках** и **полный контур только там, где молчаливый пропуск дорог**: миграции, образ, auth/API trust, pins toolchain, workflows.

Правило сужения: неизвестный или смешанный путь **никогда** не сужает gate. Он остаётся на `fast_ci` или поднимается в `full_acceptance`.

## Scopes

| Scope             | Когда                                                                                                                                                                                                                               | Jobs                                                  | Ориентир wall-time |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------ |
| `documentation`   | Только Markdown / planning JSON·md·py / `README`·`AGENTS`·`CONTRIBUTING`                                                                                                                                                            | `plan` (tracker + doc links + classify)               | ~0.5–1 мин         |
| `unit_ci`         | Только UI (`packages/ui`, `src/components`) и/или allowlist-guard `mainline-repository-policy.test.ts` (+ docs)                                                                                                                     | `plan`, `unit` (`pnpm check:code`)                    | ~3–5 мин           |
| `fast_ci`         | Обычный код приложения, в т.ч. `site/src/features/**`, сервисы, lib — без infra/trust hot paths                                                                                                                                     | `plan`, `unit`, `verify` (DB), `image`, `smoke`       | ~6–10 мин          |
| `full_acceptance` | Infra/trust: workflows, Docker/Compose, migrations/schema, lockfiles/pins, `config`/`security`/`storage`, выбранные API/repos, inventory-guard тесты; **или** любой non-docs push на `main`; тег `v*`; `workflow_dispatch` с `full` | Все jobs + browser rehearse + production compose/mail | ~12–20 мин         |

Измерение (успешный full PR CI, 16 ноября 2026): самый долгий job — Sequential database ~9–10 мин; unit ~3.5 мин; image ~5 мин; browsers ~1.5–4 мин каждый. Параллельный wall ≈ max(job), не сумма.

## Что сознательно не делает full на `dev`/PR

- Правки под `site/src/features/**` → `fast_ci` (unit+DB+image+smoke достаточно до merge в `main`).
- Docs + обновление `mainline-repository-policy.test.ts` → `unit_ci` (guard должен пробежать, browsers не нужны).
- Чистые docs → только `plan`.

## Линия `main`

После merge PR уже имеет зелёный scoped (или full) прогон на merge-commit candidate. Push в `main` с **кодом** всё ещё включает `full_acceptance` как пояс на release-line (новый SHA merge-коммита). Docs-only push/merge на `main` остаётся `documentation`.

Теги `v*` и ручной `workflow_dispatch` с `full=true` — всегда полный контур.

## Локальные аналоги

| Scope             | Локально                                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| `documentation`   | `pnpm docs:check` (+ при правке tracker: `python planning/tools/check_tracker.py` и `render_backlog.py --check`) |
| `unit_ci`         | `pnpm check:code`                                                                                                |
| `fast_ci`         | `pnpm check:code`, затем disposable `pnpm test:database` / `node scripts/run-ci-aligned-vitest.mjs`              |
| `full_acceptance` | `pnpm release:verify` / полный CI; не ослаблять CSRF или disposable DB preflight                                 |

## Как читать результат

1. Job **Choose verification scope** печатает JSON: `code`, `unitOnly`, `full`, `scope`, `changedFiles`.
2. **CI result** требует success ровно для jobs выбранного scope (`scripts/ci-summary.mjs`). Skipped вне scope — норма.
3. PASS относится только к exact SHA. Новый commit = новая проверка.

## Ошибка и что делать

| Симптом                                          | Действие                                                                         |
| ------------------------------------------------ | -------------------------------------------------------------------------------- |
| Неожиданный `full_acceptance` на «мелкой» правке | Проверьте diff: workflow, lockfile, migration, `packages/security                | storage | config`, auth API, `scripts/` |
| Docs-миграция гоняет browsers                    | Убедитесь, что в commit нет лишнего code-файла; guard allowlist один → `unit_ci` |
| Хотите полный прогон без hot path                | `workflow_dispatch` с `full=true` на нужном SHA                                  |
| Упало только `unit` при docs+guard               | Чините allowlist/format; не расширяйте path scope ради зелёного                  |

## Связанное

- Ветки и вклад: [`development.md`](development.md).
- Состояние продукта: [`system.md`](system.md).
- Политика в коде: `scripts/ci-policy.mjs`; тесты: `scripts/tests/ci-policy.node-test.mjs`.
