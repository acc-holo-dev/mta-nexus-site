# Открытые проблемы

**Статус:** living · только открытые риски и сохраняемые ограничения.  
Нет changelog tip/PR. Закрытие — только проверка на exact SHA / среде. Tracker: `planning/tasks.json`.

**Типы:** issue (разрыв кода/контракта) · operational gate (среда) · decision/proposal.

## Открытые gates (приоритет)

| ID                        | Тип              | Остаток                                                                     | Закрытие                                                                                        |
| ------------------------- | ---------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **F03**                   | Operational gate | Alert routing человеку на целевой среде                                     | Drill: отказ → alert → owner → recovery; evidence `check-observability-live-drill-evidence.mjs` |
| **F04**                   | Operational gate | Production backup/recovery practice                                         | Независимые копии + restore rehearsal; CI restore ≠ F04                                         |
| **F08**                   | Issue residual   | Session lock в коде есть; barrier probe на disposable/live не гонялся       | Controlled multi-connection barrier → нет новых build/receipt                                   |
| **ARC14 / OPS-06**        | Workflow         | Authoring path есть; tip journal → `0089`; generate rehearsal для новых DDL | Disposable `db:generate` перед schema change                                                    |
| OPS-09/11                 | External         | `github_settings`                                                           | Только по допуску владельца                                                                     |
| Ads UX-24–26 / GROW-02…09 | Deferred         | Не активированы                                                             | Отдельное поручение                                                                             |

**Не закрывать** F03/F04/settings/deploy/ads/GROW без live evidence и допуска.

## Локально закрытые кодовые разрывы (не production ready)

F01, F02, F05, F06, F07, F09, F10 (усиление), UI01, INT13, FLOW-09/14/16 и смежные UX/OPS — закрыты кодом на tip волнах; требуют regression на текущем SHA. Session-actor binding (`6cefa74e`) усиливает honesty HTTP→service; **не** закрывает F08 barrier и **не** F03/F04.

| Source   | Кратко                                      | Приёмка                                |
| -------- | ------------------------------------------- | -------------------------------------- |
| F01      | Guest return path / acquire                 | Browser: resource→auth→тот же acquire  |
| F02      | Beta evidence validator строгий             | Missing flags блокируют; PASS ≠ deploy |
| F05      | Overlay/writers runbook                     | Live maintenance rehearsal ещё open    |
| F06      | Unknown ≠ 0; review failure ≠ empty         | UI regression                          |
| F08 code | `lockInitiatingSession`                     | Barrier probe open                     |
| F09      | Fresh-password staff actions                | HTTP focused tests                     |
| INT13    | Comment idempotency + draft no auto-publish | Discussion compose                     |
| ARC14    | Forward-only authoring guards               | Disposable generate before DDL         |

Подробные evidence paths — в Git history этого файла до docs rewrite; карточки — `planning/tasks.json`.

## Проверки и сопровождение

Database Vitest: `fileParallelism: false`, `maxWorkers: 1`, `isolate: true`. Не поднимать parallelism без нового замера. Host/CI pin Node `26.10.0` / pnpm `12.4.2`. Unit timing helper: `node scripts/summarize-unit-timings.mjs` после `pnpm test:unit`.

## Сохраняемые инженерные ограничения

### Зависимости

- `@esbuild-kit/*` → `drizzle-kit@0.31.11`; nested `esbuild` override `0.28.2`.
- Vite pin `8.3.5` (Vitest 5 peer).
- `dependency-cruiser@18.7.2` + nested TS `6.0.3` via `packageExtensions`; не снимать до stable cruiser ≥18.8 **и** typescript ≥7.1.

### Production build

Standalone tracing excludes + non-root `/data/uploads`. Не ослаблять ради тихого build log.

### Уведомления

Потерянные fanout не восстанавливаются автоматически. Reset одного id: `pnpm notifications:delivery list|reset` + `NEXUS_NOTIFICATION_DELIVERY_RESET_ACK=YES` ([OPERATIONS](OPERATIONS.md#recovering-report-inbox-delivery)). Push — не exactly-once.

### Приёмка кандидата

`pnpm beta:fetch` → `pnpm beta:candidate` на exact tip после `full_acceptance`. Нужны retained artifacts со `status: "PASS"` и matching SHA. Отчёт **не** ставит beta live и **не** разрешает production deploy.

## GitHub / docs

Visibility, branch protection, Releases — отдельные permissions; snapshot ≠ обещание. AI-007 согласован с AGENTS (explicit owner push). ROADMAP PASS на старом SHA не переносится на новый tip.

## Правило закрытия

Нужны task/PR, acceptance check и SHA. Live gates — evidence целевой среды. Proposals (mute/ads/commerce) не записывать сюда как «отсутствующие баги».
