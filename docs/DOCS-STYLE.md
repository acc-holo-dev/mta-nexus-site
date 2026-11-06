# Стиль документации MTA NEXUS

**Статус:** living · канон для новых и переписываемых `.md`.  
**Связано:** [PROJECT-MAP.md](PROJECT-MAP.md) · [AGENT.md](AGENT.md) · [archive/DOCS-MIGRATION.md](archive/DOCS-MIGRATION.md) (история DOC-01…05).

## Назначение файлов

| Маркер     | Значение                                                                 |
| ---------- | ------------------------------------------------------------------------ |
| `living`   | Актуальный контракт или факт; правят при изменении реальности            |
| `derived`  | Генерируется из другого источника; руками не редактировать               |
| `archive`  | История миграции/пакета; не рабочий вход агента                          |
| `proposal` | Направление или GROW/ads; не launch-blocker бесплатной beta по умолчанию |

В шапке living-документа желательны: **Статус**, кратко **для кого**, ссылка на соседний канон.

## Язык и тон

- Канон текста: **русский**. Идентификаторы кода, пути, команды, ID задач — в backticks / латинице как в репозитории.
- Пишите коротко: один раздел — одна цель. Не повторяйте ROADMAP внутри CURRENT-STATE.
- Явно разделяйте: **факт** (код/CI/среда), **план** (roadmap/карточка), **предложение** (proposal / needs_decision).

## Запрещённые антипаттерны

- Лента tip-honesty / changelog PR в `CURRENT-STATE.md` — история живёт в Git.
- Второй backlog вне `planning/tasks.json`.
- Утверждение «verified green» / «production ready» без exact SHA, команды проверки и результата.
- Дублирование полного текста decision register в нескольких файлах; ID сохраняются в [handbook/13-DECISION-REGISTER.md](handbook/13-DECISION-REGISTER.md).

## Структура разделов (предметные контракты)

Рекомендуемый каркас: цель → акторы/права → happy path → ошибки и лимиты → связь с кодом/ops → открытые gaps. Не копируйте UI-спеки целиком — ссылайтесь на [UX-CONTRACT.md](UX-CONTRACT.md) и [FLOWS.md](FLOWS.md).

## Derived документы

| Файл                         | Источник                         | Команда                                      |
| ---------------------------- | -------------------------------- | -------------------------------------------- |
| `docs/ROADMAP.md`            | `planning/tasks.json`            | `python planning/tools/render_backlog.py`    |
| `docs/TASKS.md`              | `planning/tasks.json`            | то же; не править вручную                    |
| `docs/TRACEABILITY.md`       | import / render pipeline         | то же; путь в корне `docs/` до D5            |

Живой статус исполнения — только [`planning/tasks.json`](../planning/TRACKER.md). Архив DOC: [`archive/`](archive/README.md).

## Проверки после правок docs

1. `pnpm docs:check` — ссылки и якоря.
2. При добавлении/удалении файла в `docs/*.md` — обновить allowlist в `tests/mainline-repository-policy.test.ts`.
3. Путь `docs/OPERATIONS.md` и обязательные operator markers не ломать без согласованного переноса consumers (`scripts/observability-evidence-lib.mjs`, operator suites).
4. Изменение policy-теста → полный CI-контур по `scripts/ci-policy.mjs`, не «docs-only» ослаблением gate.

## Порядок переработки (волны)

Волны на PR #820: **D0–D5** landed · **D4** полный разрез `docs/ops/*` (`dev-startup`, `verification`, `production-boundary`, `inbox-recovery`, `backup-recovery`, `resource-safety`, `release`, `workers`). Path `docs/OPERATIONS.md` pinned (stubs + markers). Остаётся: D6 acceptance / nav polish after merge. Не смешивать tip-honesty PR с волнами docs.
