# Скрипты

Здесь инструменты, проверки и вспомогательные модули репозитория. Смысл: между скриптом и
удобной командой — тонкий слой `package.json`; вызывайте **pnpm task**, а не скрипт напрямую,
если для него есть задача. Типы скриптов:

- **entrypoint** — точка входа, которая сама что-то запускает/проверяет; обычно привязана к pnpm task.
- **lib** — модуль, который импортируют другие скрипты; сам по себе ничего не запускает.
- **CI-only** — используется в CI-гейтах/обвязке, реже для локальной работы.
- `scripts/tests/**` — конкретные `*.node-test.mjs` и browser/playwright прогоны, которые вызывают `test:*` задачи (см. ниже).

## Основные entrypoint-ы и их pnpm-задачи

| Скрипт                                                       | Тип        | pnpm task                                   | Назначение |
| ------------------------------------------------------------ | ---------- | ------------------------------------------- | ---------- |
| `scripts/check-doc-links.mjs`                                | entrypoint | `pnpm docs:check`                           | Локальные Markdown-ссылки и якоря |
| `scripts/nexus-doctor.mjs`                                   | entrypoint | `pnpm nexus:doctor` / `dev:preflight`       | Префлайт окружения |
| `scripts/check-legal-surfaces.mjs`                           | entrypoint | `pnpm legal:check`                          | Легальные поверхности продукта |
| `scripts/release-evidence.mjs`                               | entrypoint | `pnpm release:verify`                       | Релизные свидетельства (не deploy) |
| `scripts/check-observability-readiness-evidence.mjs`         | entrypoint | `pnpm observability:verify`                 | Готовность observability (evidence) |
| `scripts/check-production-recovery-acceptance-evidence.mjs`  | entrypoint | `pnpm recovery:acceptance:verify`           | Evidence recovery acceptance |
| `scripts/check-web-push-soak-evidence.mjs`                   | entrypoint | `pnpm push:soak:verify`                     | Evidence Web Push soak |
| `scripts/fetch-beta-candidate-evidence.mjs`                  | entrypoint | `pnpm beta:fetch`                           | Скачать retained CI-артефакты (`gh`) |
| `scripts/beta-candidate-evidence.mjs`                        | entrypoint | `pnpm beta:candidate`                       | Отчёт кандидата (не open beta) |
| `scripts/ci-diagnose.mjs`                                    | entrypoint | `pnpm ci:diagnose`                          | Диагностика CI-гейтов |
| `scripts/run-focused-tests.mjs`                              | entrypoint | `pnpm test:focus`                           | Узкий Vitest / `.node-test.mjs` прогон |
| `scripts/run-isolated-tests.mjs`                             | entrypoint | `pnpm test:isolated`                        | Полный Vitest в одноразовой БД |
| `scripts/run-tooling-tests.mjs`                              | entrypoint | `pnpm test:tooling`                         | Tooling-проверки (pins, infra) |
| `scripts/run-ci-aligned-vitest.mjs`                          | entrypoint | (CI) unit-прогон, выровненный с CI         | Единый unit-гейт |

## Библиотеки (lib)

| Модуль                                          | Используется в |
| ----------------------------------------------- | -------------- |
| `scripts/*-lib.mjs` (например `beta-candidate-lib`, `legal-surfaces-lib`, `release-evidence-lib`, `observability-evidence-lib`, `web-push-evidence-lib`, `fetch-beta-candidate-evidence-lib`) | Соответствующие entrypoint-ы и `*.node-test.mjs` |
| `scripts/disposable-test-database.mjs`          | DB-подготовка для `test:focus` / `test:isolated` |

## CI / служебные

`ci-policy.mjs`, `ci-summary.mjs`, `infra-image-policy.mjs`, `toolchain-policy.mjs`,
`resolve-infra-image-digests.mjs`, `record-ghcr-publish-receipt.mjs`,
`summarize-unit-timings.mjs`, `prepare-dev-mailpit.mjs`, `generate-web-push-vapid.mjs`,
`register-ts-directory-resolve.mjs` и обвязка `.sh` / `.ps1` (`check-*.sh`, `run-*-compose.sh`,
`start-production.sh`, `validate-ci-image.sh`) — CI/эксплуатационные помощники; они не заменяют
хард-код поведение, задаваемое пакетами.

> **Итоговая проверка кода:** `pnpm check:code` — единственная локальная host-команда
> здоровья кода (формат, lint, типы, boundaries, unused, unit + tooling, без Docker).
> Альтернатива: `pnpm docs:check` для документации. Полные гейты для каждого SHA подтверждаются в CI.

## Тесты в `scripts/tests/`

Нижележащие `*.node-test.mjs` и browser/playwright прогоны (`*.playwright.mjs`, `*.browser.mjs`)
вызывает `pnpm test:unit` / `test:focus` / `test:tooling` / `test:isolated` / `test:database`.
Не редактируйте их как «просто файлы»: изменение требуется подтверждать проходом соответствующей
pnpm-задачи на конкретном SHA.

Этот файл — указатель, а не дублирующий журнал. Единственный рабочий tracker —
[`planning/tasks.json`](../planning/tasks.json).