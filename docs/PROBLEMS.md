# Открытые проблемы

Здесь только проблемы, которые ещё нужно проверить или решить. Не добавляйте сюда историю завершённых изменений; она хранится в Git. Статус подтверждается конкретным запуском на конкретном коммите и среде.

## Зависимости

Регулярно проверять `pnpm audit` и обновлять зависимости небольшими группами с тестами и сборкой. Обоснованные ограничения (проверяются `scripts/tests/toolchain-pins.node-test.mjs`):

- `@esbuild-kit/*` ещё тянет `drizzle-kit@0.31.11`; безопасной замены нет, пока upstream не уберёт loader. Nested `esbuild` уже зафиксирован override на `0.28.2`.
- Vite закреплён на `8.3.5` (Vitest 5 peer: `^6.4 || ^7 || ^8`); дальнейшие минорные обновления — небольшими группами с `pnpm test:unit` / tooling pins.
- `dependency-cruiser@18.7.0` для `tsPreCompilationDeps` использует вложенный TypeScript `6.0.3` через `packageExtensions`. Стабильная поддержка TypeScript 7 ожидается в dependency-cruiser ≥18.8 с typescript ≥7.1; тогда расширение можно снять.

## Приёмка релиза

Локальная сборка и тесты не подтверждают готовность целевой инфраструктуры. Для кандидата: после `full_acceptance` на exact SHA выполните `pnpm beta:fetch` (скачивает retained CI artifacts через `gh`, без изобретения PASS), затем `pnpm beta:candidate` на чистом checkout. Отчёт требует `artifacts/ci-evidence.json` (с `jobResults`), `release-upgrade.json` и `backup-restore-evidence.json` со `status: "PASS"`, matching SHA и всеми флагами disposable rehearsal. Отчёт никогда не ставит open beta live и не разрешает production deploy. Полный backup/restore rehearsal (`scripts/check-backup-restore.mjs`) по-прежнему только на disposable GitHub-hosted runner (ROADMAP 19); локально подтверждается контракт топологии `compose.production.yaml`. In-repo residuals: `legal_surfaces` clears via `pnpm legal:check` (product pages only—not counsel); `observability` clears via `NEXUS_OBSERVABILITY_READY_ACK=YES pnpm observability:ready` + `pnpm observability:verify` when alert thresholds are configured (not production vendor routing). Optional Web Push still needs both soak + live provider evidence (`pnpm push:soak` / `pnpm push:provider:probe` + verify; file presence alone never invents PASS). Human gates remain: deploy authorization, counsel review of legal wording, production alert routing, live push-provider subscription.

## Доставка уведомлений

Исторически потерянные уведомления автоматически не восстанавливаются. Verification, reports, support, discussion, server-publication fanout, user-follow notices и SEC-002 build-incident notices (served download receipts after explicit quarantine opt-in) коммитят транзакционный источник (job или inbox) без Next.js `after()`; worker перепроверяет eligibility. Миграции 0083/0084/0085 не заполняют доставку для старых комментариев/публикаций/карантинов. Исчерпание повторов fanout/admission (attempts = 5) требует устранения причины и адресного reset одного id: `pnpm notifications:delivery list|reset` (`NEXUS_NOTIFICATION_DELIVERY_RESET_ACK=YES`, без bulk; канал `build_incident`) — см. [эксплуатацию](OPERATIONS.md#recovering-report-inbox-delivery); внешняя push-доставка по-прежнему не exactly-once.

## Проверки и сопровождение

Тесты PostgreSQL внутри одного запуска используют общую БД и выполняются последовательно (`fileParallelism: false`, `maxWorkers: 1`). Файлы database-проекта изолируются (`isolate: true`), потому что temp-table suites подменяют `packages/db/src/client` per-file Proxy. Полный набор не запускать одновременно с тяжёлой сборкой на ограниченном хосте. Для локальных изменений выбирать связанные проверки; дальнейшие ускорения — только по новым замерам без ослабления конкуренции и отката.

Dependency-cruiser 18.7 ещё не использует API TypeScript 7 для pre-compilation deps: см. ограничение в разделе «Зависимости». После стабильного 18.8+/TS 7.1 снять `packageExtensions` и перепроверить `analyze:architecture`.

## Production-сборка

Динамические пути local storage и absolute mail-secret files остаются runtime mounts: Turbopack может предупреждать о broad tracing. NFT-выход standalone ограничен `outputFileTracingExcludes` (tests/docs/scripts/migrations/deploy/git/env/uploads), runtime-образ стартует как `USER node` и пишет только в `/data/uploads`; migrations/workers уходят отдельным `/runtime/db`. Не ослаблять исключения и non-root runtime ради «тихого» build log.

## Размер модулей

Операции `builds` и `community-reports` разделены по сценариям (query/moderation/lifecycle и query/submit/decision) с тонкими facade. Новые связанные изменения держать в тех же границах; сам по себе размер файла не доказывает ошибку.
