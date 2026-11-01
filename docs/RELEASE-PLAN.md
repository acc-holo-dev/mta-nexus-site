# RELEASE-PLAN

**Статус: интегрированный проект доставки (DOC-02); задачи OPS не исполнены.** Дата: 1 ноября 2026. Исходный срез: `385e577e7443cf7d7b817419ce5c3b8afe87b690`, приложение `1.2.0-beta.3`. Настройки GitHub и сервер этим этапом не изменены.

Это надстройка над существующим [docs/OPERATIONS.md](OPERATIONS.md), который остаётся authoritative runbook по прежнему пути. Здесь описаны порядок, границы и будущая приёмка. Серверные команды не дублируются.

## 1. Направление и границы

Принятое направление — GitHub для кода, документации, PR/CI и подготовки обновлений; собственный сервер для работающего NEXUS. Private repository и private GHCR image — инженерный контур. **Открытая бесплатная бета остаётся открытой всем**; закрытие исходников не вводит приглашения пользователям.

Рабочие DB, uploads, runtime secrets и независимые backups не помещаются в исходный repository или release assets. Ads, платные покупки, выплаты и production DRM принимаются отдельно. GitHub visibility/план, package доступы, retention и live acceptance ещё требуют конкретного решения/допуска. Тариф аккаунта не проверялся; root подтвердил personal owner, public repo, отсутствие main protection/rulesets и Releases.

`specified` означает готовую спецификацию, а не разрешение начать работу. Поле `permission` обозначает нужный допуск: local development, GitHub settings или external live. `external_gate` нельзя закрыть чтением файлов. Указанные acceptance — будущие условия, а сведения о нынешнем коде и прежнем CI не являются их PASS.

## 2. Путь одной поставки

| Шаг | Результат | OPS задачи |
|---|---|---|
| PR → защищённый main | Принятый исходный SHA и обязательный CI result | OPS-01, OPS-09 |
| Подготовка кандидата | Согласованный toolchain, одна production сборка, full acceptance | OPS-02–OPS-07, OPS-10 |
| Registry и bundle | Private image по digest, проверенный manifest и evidence | OPS-08, OPS-10, OPS-11 |
| Публикация Release | Tag/SHA, notes, сохранённые assets; без утверждения о deployment | OPS-16 |
| Решение оператора | Проверенные recovery/alerts, выбранный exact digest и разрешённое окно | OPS-12–OPS-14, OPS-17 |
| Установка и фиксация результата | Все включённые роли одной поставки, readiness/HTTPS и deployment receipt | OPS-17 |

CI уже реализует часть этого пути: [build once](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/.github/workflows/ci.yml#L266-L294), [scope policy](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/scripts/ci-policy.mjs#L47-L84), [единый image ролей](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/compose.production-ci.yaml#L1-L23). GHCR publish, целостный manifest и deployment receipt — предлагаемые дополнения, не существующая готовая доставка.

Для релиза нужен **full_acceptance exact SHA**, а не любой зелёный scoped CI. Теги `v*` уже включают full policy; manual input full также существует. При публикации нельзя заново собрать «похожий» image и приписать ему проверки прежнего image. Если сохранённые bytes утрачены, нужен новый проверенный кандидат. [Теги и policy](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/scripts/ci-policy.mjs#L117-L125).

## 3. Контракт версии и manifest

Версия приложения удобна человеку; Git SHA определяет код; registry digest определяет конкретный container manifest/bytes для платформы. Номер PostgreSQL определяет engine, migration target — схему приложения. Human version ресурса автора, его immutable build ID/hash и MTA compatibility относятся к другому домену.

Сейчас host/CI Node pin — `26.10.0`, Docker — `node:26-alpine`, pnpm — `12.4.2`. Major Node согласован; фактическое patch-расхождение текущего CI не установлено. Требуется фиксировать actual runtime/digest релиза, а не обновлять всё до latest. TS6 у dependency-cruiser — намеренное исключение относительно TS7 проекта. PostgreSQL 18 и mount `/var/lib/postgresql` сохраняются. [Конфигурация](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/package.json#L76-L98), [toolchain exception](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/pnpm-workspace.yaml#L11-L22).

Предлагаемый manifest расширяет [release-evidence](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/scripts/release-evidence.mjs#L197-L239):

- appVersion, exact SHA, CI run/attempt и отсутствие непреднамеренного dirty state;
- actual Node/pnpm и lockfile hash; app image digest/platform и выбранные base/infra refs;
- PostgreSQL major, schema baseline/target и hashes миграций;
- включённые роли/overlays и очищенная от секретов форма конфигурации;
- версии evidence schemas и ссылки на CI, upgrade, restore и browser results;
- previous approved release и идентификатор recovery set без содержимого секретов.

Missing/mismatch поля блокируют техническую приёмку. Срок хранения bundle/образов выбирается владельцем: нынешние [14 дней CI artifact retention](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/.github/workflows/ci.yml#L653-L661) не являются долгосрочным release archive. Наличие checksum не заменяет права доступа и доверие к producer.

## 4. Обязательные различия в gates

**F02 / OPS-07:** строгий upgrade validator нужен до следующей приёмки кандидата. Неполный PASS должен отклоняться. Реальный retained artifact исходного SHA был корректным; прежний дефект helper не опровергает его и не разрешал production.

**F05 / OPS-12:** до использования maintenance recipe исправляется полный inventory writers. Проза уже требует всех; конкретная команда пропускает license/resource-release. Учитываются optional mail и внешние writers. PostgreSQL оставляют доступным для dump; одной правки формулировки недостаточно.

**F03 и F04 / OPS-13–OPS-14:** до пользовательского трафика и хранения ценных данных нужна эксплуатационная приёмка. Репозиторий не доказывает ни наличие, ни отсутствие внешних monitoring/backup settings. Проверяют согласованный off-host recovery, измеренное восстановление и цепочку отказ → alert → получение ответственным → recovery. RPO/RTO, пороги, каналы и owner не назначаются вымышленными значениями.

**ARC14 / OPS-06:** generator snapshots отстают от SQL history; конкретный будущий DDL не воспроизведён. Путь авторства миграций выбирают после disposable проверки. Это условный gate следующего schema-change, а не автоматический blocker релиза без изменения схемы.

OPS-15 hardening и OPS-18 capacity закрывают конкретные риски выбранной конфигурации. Они не превращают все архитектурные рекомендации в одинаковые launch blockers. Product/security/UX gates определяются общим roadmap; operations не подменяет их.

## 5. Private GitHub и права registry

Для private branch protection/rulesets personal owner нужен Pro либо иной поддерживаемый ownership/план; в organization — Team/Enterprise. На Free соответствующая public-защита не становится private-защитой автоматически. [Branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches), [rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository).

Private environments/secrets доступны Pro/Team, однако private required reviewers и wait timer — нет; встроенный reviewer gate требует соответствующего Enterprise-варианта. На Free после public→private environment rules/secrets игнорируются. Поэтому OPS-09 сначала требует решения о плане, затем отдельного разрешения settings-изменения. [Ограничения environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).

Publish job получает `GITHUB_TOKEN` с `packages:write` только для доверенного кандидата. PR jobs остаются без write/deploy полномочий. Сервер использует classic PAT с `read:packages` и read-доступом к private package; job token не является постоянным credential. SSO-авторизация учитывается, если применима. [GHCR authentication](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry).

Repo visibility и GHCR package visibility независимы. Наследование repository permissions не означает наследование visibility; уже public package нельзя обратно сделать private. OPS-11 проверяет namespace, linkage и access отдельно. [Package visibility](https://docs.github.com/en/packages/learn-github-packages/configuring-a-packages-access-control-and-visibility).

У private Actions compute есть включённый лимит и возможная оплата сверх него; artifact/cache storage тоже требует контроля. Актуальные billing docs используют shared included compute allowance, поэтому план не обещает фиксированное число бесплатных прогонов. Budget alerts и stop-on-limit различаются. GHCR image storage/bandwidth сейчас имеют отдельное бесплатное исключение; это не гарантия бесплатности всего CI. [Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions), [GHCR billing](https://docs.github.com/en/billing/concepts/product-billing/github-packages).

## 6. Ручной deployment и восстановление

Предлагаемый первый путь поставки: Actions готовит candidate, но не получает SSH/deploy credentials. Production не становится общим self-hosted CI runner. Оператор своим отдельным доступом выбирает exact digest, проверяет manifest и принимает решение. Это реальный ручной gate одного владельца/оператора; он не выдаётся за second-actor approval. `workflow_dispatch` — лишь запуск с write-доступом. [Manual workflow](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).

Сервер исполняет существующий [immutable runbook](OPERATIONS.md), исправленный в OPS-12. Сначала согласованный recovery set и пауза writers, затем одна управляемая migration phase, совместимые web/workers, readiness, ingress и HTTPS acceptance. Повторно падающий кандидат не оставляют бесконечно мигрировать. Все роли берут approved image; на сервере не выполняется самостоятельная сборка исходников.

Возврат старого image допустим только при подтверждённой совместимости с новой схемой. Если требуется восстановление данных, применяется согласованный recovery set и учитываются записи после его точки. PostgreSQL major upgrade — отдельная процедура, не побочный эффект смены app tag. Production данные/volumes не используются для destructive CI rehearsal.

Hosted CI сохраняется: NEXUS прямо ограничивает [upgrade rehearsal](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/scripts/check-release-upgrade.mjs#L12-L23) disposable GitHub-hosted окружением. Self-hosted runner не гарантирует чистую изоляцию даже в private repo; если он понадобится, это отдельная изолированная среда без production доступа. [GitHub runner guidance](https://docs.github.com/en/actions/reference/security/secure-use).

GitHub Release фиксирует tag/notes/assets; deployment receipt фиксирует установку: operator, environment, time, SHA, digest, schema target, previous version и outcome. Публикация Release не подтверждает deployment. [Release semantics](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases).

## 7. Очередь реализации и приёмка пакета

Локальную работу можно разбить на независимые ветки OPS-01/OPS-02/OPS-04/OPS-06/OPS-07; затем manifest, runtime portability и publish workflow по их dependencies. Это возможный порядок после разрешения разработки, без календарных обещаний. OPS-09 ожидает решения о плане; OPS-11, OPS-13, OPS-14, OPS-16, OPS-17 и OPS-18 сохраняют внешние gates.

OPS-19 относится к контракту resource versions для retention, без дублирования UI. OPS-20 остаётся deferred: private object storage вводят по измеренной потребности или отдельно принятому будущему scope; оно не активирует коммерцию. Ни Redis, ни multi-instance, ни новый публичный status/version экран не объявлены обязательными.

Следующему ИИ выдают одну задачу с exact SHA, разрешённой средой, scope и критериями. Существующие focused commands в JSON — будущие способы проверки, здесь они не запускались. Структурный тест подтверждает структуру; stateful/live acceptance требует своего доказательства. После изменений принимается новый SHA; старые artifacts остаются историческими свидетельствами.

Этот v1 принимается как review package, когда владелец согласовал границы и спорные decisions, зависимости проверены, а разрешения не перепутаны с queue state. Применение документации в repository, настройки GitHub, registry publication и deployment являются отдельными последующими действиями.

