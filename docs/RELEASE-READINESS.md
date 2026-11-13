# RELEASE-READINESS — эксплуатационный план готовности релиза

Статус: рабочая редакция, 2026-11-10, версия приложения 1.2.0-beta.3.
Бета-цепочка кандидата (**beta:fetch + beta:candidate**) выполнена на merged main `dd6c6f7d` в 2026-11-10: `status=awaiting_owner_deploy_decision`, `checkableCandidate=true`, `openBetaLive=false`, `productionAuthorized=false`. Открытая бета не объявлена live; production не авторизован.

---

## 1. Цель и границы

Этот документ описывает честный операционный путь к **кандидату свободного открытого бета-релиза**.
Он дополняет [docs/RELEASE-PLAN.md](RELEASE-PLAN.md) и реализует процедуру «Приёмка релиза»
([docs/PROBLEMS.md](PROBLEMS.md):21).

**Границы scope:**

- В scope: кандидат свободного открытого бета-релиза и его эксплуатационные требования.
- Вне scope регулярного релиза: платные подписки, реклама, DRM. Их включение — отдельные
  продуктовые решения и **не блокируют** свободную открытую бету.

**Честный контракт** (не нарушать ни при каких обстоятельствах):

- Never fabricate: не фабриковать PASS, доказательства или продуктовые метрики. Неподписанные
  одобрения, выдуманные файлы или невалидные удержанные артефакты CI — это НЕ PASS.
- Верификация реального поведения — только кодом, миграциями и выполненными проверками на конкретном SHA.
  Файлы `artifacts/` и любой вывод CI должны быть проверяемыми на точном SHA.
- Никакого production deploy, разрушительных операций с данными, реальных платежей или активации DRM —
  даже при наличии push/release-авторизации.
- Документ не инструктирует правку производных markdown-беклогов (ROADMAP.md, TASKS.md, TRACEABILITY.md —
  они регенерируются из `planning/tasks.json`). Этот план — ручной операционный документ, как RELEASE-PLAN.md.

---

## 2. Достижимые в репозитории/CI проверки

Единственный корректный путь подтверждения кандидата — полная цепочка на **merged main SHA** с
классом CI `full_acceptance`.

### 2.1 Цепочка кандидата релиза

| Шаг                     | Значение                                                                         | Требуется для PASS                                                                                                                                                                                                                                                                                                  |
| ----------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Merged main SHA         | загруженный SHA несёт `full_acceptance`                                          | статус PASS в `ci-evidence.json` на этот точный SHA                                                                                                                                                                                                                                                                 |
| `pnpm beta:fetch <sha>` | скачивает удержанные CI-артефакты для SHA через `gh` в `artifacts/` (gitignored) | ровно этот SHA; невалидный удержанный JSON **блокирует** harness                                                                                                                                                                                                                                                    |
| `pnpm beta:candidate`   | отчёт `artifacts/beta-candidate-evidence.json` на чистом checkout SHA            | категории: `exact_sha_ci` (обязательная), `tls_and_runtime`, `mail`, `storage_and_scanner`, `browsers`, `database_upgrade` (`release-upgrade.json`), `backup_restore` (`backup-restore-evidence.json`, PASS только CI), `web_push` (опционально, внешняя), `observability` (опционально, внешняя), `legal surfaces` |
| `pnpm release:verify`   | расширенный release-evidence JSON                                                | exit 1, если не `releaseCandidate=true`                                                                                                                                                                                                                                                                             |

Критично: отчёт `beta:candidate` ставит `openBetaLive=false` и `productionAuthorized=false`. Он
**никогда** не заявляет, что открытая бета live, и никогда не авторизует production deploy.

### 2.2 Выполненная цепочка кандидата на merged main (`dd6c6f7d`)

Выполнено на чистом checkout `dd6c6f7d`:

- `pnpm beta:fetch dd6c6f7d` — загружены удержанные артефакты CI run `42770968105` (PASS) в `artifacts/`:
  `ci-evidence.json`, `release-upgrade.json`, `backup-restore-evidence.json`.
- `pnpm beta:candidate` — отчёт `artifacts/beta-candidate-evidence.json` (`evidenceSha256=837ebc…fec5a12f4`):
  `status=awaiting_owner_deploy_decision`, `checkableCandidate=true`, `technicalBlockers=none`,
  `openBetaLive=false`, `productionAuthorized=false`. Все 7 обязательных технических категорий — `passed`;
  `deployment_authorization` — `blocked` by design (требуется отдельное решение владельца); residuals —
  `web_push` и `observability` (обе optional, внешние/человеческие gates).

Локальные проверки готовности на хосте:


- `pnpm legal:check` — **PASSED** (exit 0): маршруты `/terms`, `/privacy`, `/community-rules` на месте.
  Это проверка **продуктовых поверхностей**, а не юридическое одобрение — ревью counsel остаётся human gate.
- `pnpm observability:ready` (`NEXUS_OBSERVABILITY_READY_ACK=YES`) — **НЕ прошёл**: не заданы три порога
  prod-алертов: `WEB_PUSH_QUEUE_ALERT_PENDING_PERCENT`, `WEB_PUSH_QUEUE_ALERT_DUE_JOBS`,
  `WEB_PUSH_QUEUE_ALERT_OLDEST_AGE_SECONDS` (ключи из `observability-evidence-lib.mjs`
  `OBSERVABILITY_ALERT_ENV_KEYS` и `ALERT_THRESHOLD_LIMITS`). Это операторская конфигурация роутинга
  prod-алертов → **production alert-routing human gate**, а не локальный фикс кода. Произвольные значения
  здесь сфабриковали бы операторское решение.
- Шаблон live-дрилла observability намеренно поставляется с плейсхолдерами `REPLACE_WITH_TARGET_ENV` /
  `REPLACE_WITH_ONCALL_OWNER` и т.п.; при невыполнении вердикт `template_not_executed`, т.к. требуется
  реальный live-дрилл на целевом окружении.
- Полная репетиция backup/restore доступна **только в CI** (см. §3).

---

## 3. Эксплуатационные / внешние gates с доказательствами целевого окружения

Эти gates невозможно закрыть с dev-хоста. Доказательства должны прийти из целевого окружения или
из настроек прав/пакетов GitHub.

| Задача                                  | Природа                             | Требуемое доказательство                                                                                                                                                                                                                            |
| --------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OPS-11 (private GHCR publish)           | внешняя (permissions/packages)      | реальный publish в private GHCR; на этом хосте нет достижимой конфигурации                                                                                                                                                                          |
| OPS-13 (F04 backup/recovery live drill) | **CI-only**                         | drill на disposable GitHub-hosted runner (`backup-restore-contract.mjs` `assertDisposableRunnerPolicy`: `GITHUB_ACTIONS=true` И `RUNNER_ENVIRONMENT=github-hosted`, docker context default). На Linux dev-хосте PASS-доказательство получить нельзя |
| OPS-14 (F03 alerts live drill)          | внешняя                             | live-цель для доставки реального алерта                                                                                                                                                                                                             |
| OPS-16 (release bundle publish)         | зависит от OPS-11                   | GitHub Releases + удержанные артефакты; git-side, но нужен private образ из OPS-11                                                                                                                                                                  |
| OPS-17 (deploy exact digest + receipt)  | внешняя                             | live-цель + авторизация deploy + сам deployment receipt; culminating gate F3                                                                                                                                                                        |
| OPS-18 (single-instance capacity live)  | внешняя (нет live-трафика на хосте) | live-окружение с реальной нагрузкой                                                                                                                                                                                                                 |

Уточнение классов:

- **CI-only (не локально):** OPS-13 backup/restore. Никогда не описывать как локально выполнимую.
- **Реально без цели (нечего доказывать здесь):** OPS-11 (private GHCR visibility/packages),
  OPS-17 (prod deploy receipt), OPS-14 (реальная доставка алерта), OPS-18 (live capacity).

Связанное: OPS-09 (запись состояния правил Option-A, рег. наборы 26842428/26842432) закрывается PR #1165,
который также закрывает зонд lock-barrier F08 (initiating-session).

---

## 4. Продуктовые решения вне релиза

Ни один из пунктов этого раздела **не** является блокером свободной открытой беты.

| Область     | Задача                          | Nature                                                                                                        | Статус                                         |
| ----------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| OPS-20      | private object storage          | deferred by design (см. OPS-05); вводить только при измеренной потребности или отдельно принятом future scope | не релиз-блокер                                |
| GROW-02..09 | user-retention pilots (F4 GROW) | scope_specific                                                                                                | продуктовые пилоты, не блокируют открытую бету |
| UX-24/25/26 | governed ad placements (F5)     | требует продуктово-рекламного решения                                                                         | явно не блокеры; реклама анонсируется отдельно |

---

## 5. Блокеры и отсрочки

Что блокирует подтверждение кандидата vs. постоянные остатки.

| Gate                                                          | Блокирует подтверждение кандидата? | Класс закрытия                            |
| ------------------------------------------------------------- | ---------------------------------- | ----------------------------------------- |
| `full_acceptance` PASS на merged main SHA                     | Да (обязателен)                    | merge PR + CI                             |
| Retained CI artifacts валидны на этот SHA                     | Да                                 | `beta:fetch` / `gh`                       |
| `beta:candidate` с `exact_sha_ci` PASS                        | Да                                 | CI-only                                   |
| Deploy authorization                                          | Да                                 | persistent human gate                     |
| Counsel review юридических формулировок                       | Да                                 | persistent human gate                     |
| Production alert routing (observability) на target env        | Да                                 | persistent human gate (не локальный фикс) |
| Live push-provider подписка + soak                            | Да                                 | внешняя                                   |
| GitHub visibility/package/retention для private GHCR (OPS-11) | Да (для OPS-16)                    | external permission gate                  |
| Production deployment receipt (OPS-17)                        | Да                                 | external gate                             |
| OPS-20 / GROW-02..09 / UX-24/25/26                            | Нет                                | вне scope релиза                          |

Постоянные человеческие gates (не закрываются и не фабрикуются с dev-хоста): deploy authorization,
ревью counsel, конфигурация prod alert-routing, live push soak, GitHub packages-настройки, live receipt.

---

## 6. Состояние кандидата и следующий шаг

### Выполнено (merged main `dd6c6f7d`)

1. PR #1165 merged в `main`; main SHA `dd6c6f7d` получил **PASS** в `full_acceptance` (run `42770968105`,
   удержанные артефакты валидны на этот SHA).
2. На чистом checkout `dd6c6f7d` выполнены `pnpm beta:fetch dd6c6f7d` и `pnpm beta:candidate`.
   Отчёт: `status=awaiting_owner_deploy_decision`, `checkableCandidate=true`, `technicalBlockers=none`,
   `exact_sha_ci` = PASS для точного SHA.
3. Локально-закрытая часть кандидата подтверждена честно. Открытая бета **не** объявлена live и
   production **не** авторизован (`openBetaLive=false`, `productionAuthorized=false`).

### Остаточные gates до фактического включения открытой беты

Эти gates нельзя закрыть с dev-хоста и/или в CI; доказательства требуют целевого окружения или
отдельного решения владельца (подробнее §3 и §5):

| Gate                                                                                     | Класс закрытия                                      |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Deploy authorization                                                                     | persistent human gate — отдельное решение владельца |
| Counsel review юридических формулировок `/terms`, `/privacy`, `/community-rules`         | persistent human gate                               |
| Production alert routing (observability) на target env (`WEB_PUSH_QUEUE_ALERT_*` пороги) | persistent human gate                               |
| Live push-provider подписка + soak (`web_push`)                                          | внешняя                                             |
| GitHub visibility/package/retention для private GHCR (OPS-11)                            | external permission gate                            |
| Production deployment receipt (OPS-17)                                                   | external gate                                       |

Отсрочено, не релиз-блокеры: OPS-20, GROW-02..09, UX-24/25/26.

### Действие

Получить решение владельца по деплою открытой беты. Не заявлять бету live и не авторизовать
production, пока `openBetaLive=false` / `productionAuthorized=false`.

---

### Проверяемость

Каждое утверждение здесь проверяется по: `scripts/beta-candidate-lib.mjs`
(`BETA_CANDIDATE_CATEGORIES`), `scripts/fetch-beta-candidate-evidence.mjs`, `scripts/beta-candidate-evidence.mjs`,
`scripts/release-evidence.mjs`, `scripts/ci-policy.mjs`, `scripts/backup-restore-contract.mjs`,
`scripts/check-legal-surfaces.mjs`, `scripts/run-observability-readiness.mjs`,
`scripts/observability-evidence-lib.mjs`, `planning/tasks.json`, [docs/ROADMAP.md](ROADMAP.md),
[docs/PROBLEMS.md](PROBLEMS.md):21, [docs/RELEASE-PLAN.md](RELEASE-PLAN.md).
