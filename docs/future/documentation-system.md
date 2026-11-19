# Система документации (проект переноса)

**Статус:** перенос начат (волна 1). **Дата:** 16 ноября 2026 (Europe/Moscow).  
**Цель:** один самодостаточный контур документации без обязательных цепочек «прочитайте ещё пять файлов», с проверяемыми фактами и минимальным числом автоматически поддерживаемых представлений.

Волна 1 уже перенесла: `current/system.md`, `current/development.md`, `issues/constraints.md`, `future/*` topic owners, `archive/migrations|pilots`. Волна domains: `current/domains/{RESOURCES,COMMUNITY,SERVERS-ORGS,TRUST-STAFF}.md`; корневые прежние имена остаются **redirect stubs**. Ещё впереди: `operations` path cutover, перенос `planning/` → `docs/planning/`, удаление stubs, generated overview/status.

## 1. Дерево целевого состояния

```text
AGENTS.md                       # Полный контракт исполнителя (самодостаточный вход)
README.md                       # Продукт, минимальный запуск, навигация по docs/

docs/
├── current/                    # Подтверждённое устройство системы
│   ├── system.md               # Продукт, границы beta, что реально включено
│   ├── architecture.md
│   ├── development.md          # Локальный контур + ветки main/dev + вклад
│   ├── operations.md           # English-first runbook (бывший OPERATIONS.md)
│   ├── quality.md              # Проверки, CI scope, evidence
│   ├── security.md
│   ├── decisions.md            # NX + указатель на архивный baseline ID
│   └── domains/                # Только самостоятельные предметные контракты
│       ├── resources.md
│       ├── community.md
│       ├── servers-orgs.md
│       └── trust-staff.md
├── issues/                     # Подтверждённые ограничения и открытые проблемы
│   └── constraints.md
├── future/                     # Цели и условия принятия (не «уже сделано»)
│   ├── initiatives.md          # Индекс направлений
│   ├── release.md
│   ├── advertising.md
│   ├── commerce.md
│   ├── retention.md
│   ├── server-packs.md
│   └── documentation-system.md # Этот файл (удалить или архивировать после переноса)
├── planning/                   # Единый контур задач (перенос из корневого planning/)
│   ├── tasks.json
│   ├── task-schema.json
│   ├── source-register.json
│   ├── milestones.json
│   ├── retention-directions.json
│   ├── spec-amendments.json
│   ├── tools/                  # check, render, tests
│   └── generated/
│       ├── overview.md         # Единственный человекочитаемый обзор backlog
│       └── status.json         # Машинный снимок счётчиков для CI/агентов
└── archive/                    # Frozen и исторические свидетельства
    ├── decision-register.md    # Полный baseline ID (нынешний handbook/13-…)
    ├── decision-baseline.json
    ├── import-baseline/
    ├── migrations/             # DOCS-MIGRATION, STRUCTURE-REFACTORING и аналоги
    └── pilots/                 # Завершённые пилотные записки
```

Корневые `docs/AGENT.md`, плоский набор `docs/*.md` и `planning/` после переноса не остаются второй копией истины.

## 2. Правила содержания

1. **Самодостаточность.** Документ своей области содержит условия, объяснение, команды, ожидаемый результат и действия при ошибке. Ссылки на соседние файлы — удобство, не обязательная цепочка чтения.
2. **Одно место.** Задачи — только в `docs/planning/tasks.json`. Действующие правила — в `current/`. Предложения — в `future/`. Проблемы — в `issues/`. История — Git + `archive/`.
3. **Проверяемые факты.** У существенного утверждения есть источник, дата сверки (`verified_at`) и при необходимости SHA или URL CI. Неподтверждённое пишется как гипотеза или переносится в `future/` / `issues/`.
4. **Тонкие файлы не плодятся.** Отдельный файл в `domains/` появляется только когда у поверхности есть собственные инварианты и объём. Library, accounts, notifications, discovery остаются разделами внутри родительского контракта, пока не потребуют независимого файла.
5. **Языки.** Контракты — русский; `operations.md` — English-first и authoritative для команд; код/CI/коммиты — английский; UI — RU/EN.

## 3. Что генерировать автоматически

Автогенерация сокращает дубли, а не создаёт третий backlog.

| Артефакт                                                        | Источник                            | Правило                                                     |
| --------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------- |
| `docs/planning/generated/overview.md`                           | `tasks.json` + milestones           | Единственный обзор очереди и фаз; ручные правки запрещены   |
| `docs/planning/generated/status.json`                           | тот же рендер                       | Счётчики `done` / `not_started` / blockers для CI и агентов |
| (удалить как канон) `ROADMAP.md`, `TASKS.md`, `TRACEABILITY.md` | сейчас генерируются в корне `docs/` | После переноса не поддерживать три больших Markdown-копии   |

Не генерировать автоматически: предметные контракты, operations runbook, текст решений, список проблем. Их пишет человек/агент по фактам.

## 4. Автоматические проверки точности

Один вход: `python docs/planning/tools/check_docs.py` (обёртка над существующими checker/renderer + новые гейты).

| Проверка                   | Защищает от                                                                            |
| -------------------------- | -------------------------------------------------------------------------------------- |
| Schema + DAG `tasks.json`  | битый tracker, циклы зависимостей                                                      |
| `render --check`           | drift generated overview/status                                                        |
| Markdown links/anchors     | мёртвые ссылки                                                                         |
| Allowlist дерева `docs/`   | случайные новые корневые `.md` и вторые backlog                                        |
| Front-matter / claim block | документ `current/` или `issues/` без `verified_at`                                    |
| SHA claim check            | указанный SHA отсутствует в Git                                                        |
| One-source grep            | запрещённые фразы «единственный tracker» вне planning; ручные списки задач в `future/` |
| Branch policy              | только `main` + `dev`; CI и Dependabot согласованы                                     |

CI `plan` продолжает гонять эти проверки до выбора scope, включая docs-only изменения.

## 5. Ветки и поток изменений (закрепление)

Постоянные ветки репозитория — только две:

| Ветка  | Роль                                                                   |
| ------ | ---------------------------------------------------------------------- |
| `dev`  | Интеграционная: сюда идут коммиты разработки и Dependabot              |
| `main` | Защищённая линия выпуска; обновляется merge PR `dev` → `main` после CI |

Процесс: изменения на `dev` → CI на push в `dev` → PR в `main` → CI на PR → merge → CI на `main`. Прямой push в `main` блокируется ruleset (обязателен `CI result`). Прочие долгоживущие ветки не ведутся; временные ветки Dependabot удаляются после merge/close.

Настройки GitHub (ruleset для `dev`, default branch, удаление merged branches) меняет владелец с правом `github_settings`. Документация фиксирует желаемое состояние; наличие текста не меняет серверные правила само.

## 6. Карта переноса (откуда → куда)

| Сейчас                                                                    | Цель                                                                         |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `AGENTS.md` + `docs/AGENT.md`                                             | один полный `AGENTS.md`; короткий указатель на время миграции допустим       |
| `README.md`                                                               | продукт + запуск + навигация по новым путям                                  |
| `CURRENT-STATE.md`, `PRODUCT.md`                                          | `current/system.md`                                                          |
| `ARCHITECTURE.md`, `PROJECT-MAP.md` (инженерная часть)                    | `current/architecture.md` (+ карта путей внутри)                             |
| `GETTING-STARTED.md`, `CONTRIBUTING.md`                                   | `current/development.md`                                                     |
| `OPERATIONS.md`                                                           | `current/operations.md` (путь менять только вместе с evidence-потребителями) |
| `RELEASE-READINESS.md`, CI-описания                                       | `current/quality.md`                                                         |
| trust/security фрагменты                                                  | `current/security.md`                                                        |
| `DECISIONS.md`                                                            | `current/decisions.md`                                                       |
| `RESOURCES.md` / `COMMUNITY.md` / `SERVERS-ORGS.md` / `TRUST-STAFF.md`    | `current/domains/*`                                                          |
| `PROBLEMS.md`                                                             | `issues/constraints.md`                                                      |
| `ROADMAP.md`, commercial/retention/ads/server-pack/release планы          | `future/*`                                                                   |
| корневой `planning/`                                                      | `docs/planning/`                                                             |
| `handbook/13-DECISION-REGISTER.md`, baselines, migration journals, pilots | `docs/archive/`                                                              |

Порядок исполнения: (1) закрепить ветки и CI, (2) ввести дерево и checker allowlist параллельно со старыми путями, (3) переносить по одному владельцу содержания с обновлением потребителей, (4) удалить superseded пути одним проверяемым шагом, (5) архивировать эту спецификацию.

## 7. Критерий готовности переноса

- `AGENTS.md` и `README.md` достаточны для старта без обязательного чтения handbook.
- Нет второй живой копии backlog вне `docs/planning/tasks.json`.
- Generated overview/status совпадают с JSON (`--check` зелёный).
- Policy-тесты, `check-doc-links`, operator evidence читают новые пути.
- В GitHub остаются только `main` и `dev` (плюс эфемерные Dependabot до слияния).
- Утверждения в `current/` и `issues/` имеют дату сверки; устаревшие перенесены в archive или исправлены.

## 8. Что сознательно не делаем

- Не заменяем Git историческими «журналами передачи» в Markdown.
- Не создаём GitHub Issues до отдельного поручения `github_settings`.
- Не ослабляем CI-policy, чтобы миграция выглядела docs-only при изменении mainline policy.
- Не объявляем перенос завершённым по числу файлов или закрытых карточек.
