# Миграция документации без потери решений

Карта для SHA `385e577e7443cf7d7b817419ce5c3b8afe87b690`. **DOC-01:** инвентаризированы 56 docs Markdown + README/AGENTS (58 в `planning/documents-map.json`); 309 decision ID совпадают с `planning/decision-baseline.json`; потребители путей зафиксированы ниже. **DOC-02:** ядро интегрировано. **DOC-03:** JSON-in-repo tracker. **DOC-05:** предметные контракты созданы. **DOC-04:** удалены 49 superseded глав; kept `00-README`, `13-DECISION-REGISTER`, `15-AI-CONTEXT-INDEX`; manifest `planning/deletion-manifest.json`. Список — план ответственности, а не разрешение удалить всё, что оказалось в нескольких главах.

## Порядок

DOC-01 проверяет baseline и всех потребителей. DOC-02 интегрирует короткий вход, актуальный срез, решения и очередь. DOC-03 выбрал JSON-in-repo (`planning/TRACKER.md`); GitHub Issues отложены. DOC-05 последовательно объединяет предметные контракты. DOC-04 удаляет отдельные доказанно лишние файлы после завершённого переноса.

В `planning/decision-baseline.json` сохранены **309 исходных decision ID** со статусами, строками, ссылками и hashes. Это индекс, а не копия текста решений. Перед заменой реестра переносится точный действующий смысл каждой строки и уникальные требования вне реестра. AI-007 согласуется с AGENTS; его ID сохраняется, история остаётся в Git.

Текущие разделы PROBLEMS о зависимостях, уведомлениях, DB test isolation и runtime также сохраняются. Новый аудит дополняет реестр; он не закрывает старые остатки молча.

## Потребители, которые требуют совместного изменения

- `tests/mainline-repository-policy.test.ts` проверяет точные root docs/handbook paths и README ссылки. Обновить ожидаемую структуру, сохранив смысл инварианта.
- `scripts/observability-evidence-lib.mjs` читает `docs/OPERATIONS.md` и обязательные error/worker markers. Сохранить путь и полезные команды до проверенного переноса.
- Operator/dev-startup tests содержат контракты команд и версий; найти затронутые через `rg`.
- `scripts/check-doc-links.mjs` проверяет Markdown-ссылки/якоря, но не программные readFile и текст в backticks. Одного PASS недостаточно.
- CI-policy относит изменение mainline policy test к full acceptance; не делать миграцию искусственно docs-only ослаблением gate.

## DOC-01: сверка baseline (выполнено)

- **Checkout:** ветка интеграции поверх `385e577e7443cf7d7b817419ce5c3b8afe87b690` (совпадает с baseline пакета); незакоммиченные локальные `_agent_*` скрипты сохранены и не входят в интеграцию.
- **Документы:** 56 Markdown в `docs/` (+ README/AGENTS) учтены в `planning/documents-map.json` (58). Handbook-главы не удалялись.
- **Decision ID:** 309 уникальных ID в `docs/handbook/13-DECISION-REGISTER.md` совпадают с `planning/decision-baseline.json`.
- **Потребители путей:** `tests/mainline-repository-policy.test.ts` (allowlist root docs + README/AGENTS ссылки); `scripts/observability-evidence-lib.mjs` и operator suites читают `docs/OPERATIONS.md`; `scripts/check-doc-links.mjs`; `scripts/ci-policy.mjs` (docs + planning как documentation; изменение mainline policy → full_acceptance).
- **Критерий сохранения смысла:** полный текст baseline решений остаётся в `13-DECISION-REGISTER.md`; NX — только дополнения в `DECISIONS.md`; активные ограничения PROBLEMS сохранены целиком и дополнены аудитом. Удаления отложены до DOC-04 после DOC-05.

## Карта старого и нового

Все target paths — проект ответственности. Наличие короткого нового контракта в пакете ещё не означает, что в него уже перенесён весь текст перечисленных глав.

| Исходный документ                                                                    | Предлагаемый владелец содержания                                | Действие                                                      |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------- |
| [README.md](../README.md)                                                            | `README.md`                                                     | keep_update_navigation                                        |
| [AGENTS.md](../AGENTS.md)                                                            | `AGENTS.md`, `docs/AGENT.md`                                    | shorten_and_delegate                                          |
| [docs/ARCHITECTURE.md](ARCHITECTURE.md)                                              | `docs/ARCHITECTURE.md`                                          | keep_consolidate_responsibility                               |
| [docs/OPERATIONS.md](OPERATIONS.md)                                                  | `docs/OPERATIONS.md`                                            | keep_path_and_operator_contract                               |
| [docs/PROBLEMS.md](PROBLEMS.md)                                                      | `docs/PROBLEMS.md`                                              | merge_active_residuals_and_new_audit                          |
| [docs/PROJECT-MAP.md](PROJECT-MAP.md)                                                | `docs/PROJECT-MAP.md`                                           | keep_consolidate_responsibility                               |
| [docs/handbook/00-README.md](handbook/00-README.md)                                  | `docs/PROJECT-MAP.md`, `docs/AGENT.md`                          | merge_after_semantic_review                                   |
| [docs/handbook/01-PROJECT-CONCEPT.md](PRODUCT.md)                                    | `docs/PRODUCT.md`                                               | deleted_doc04; owner `docs/PRODUCT.md`; history Git           |
| [docs/handbook/02-ROLES-AND-PERMISSIONS.md](TRUST-STAFF.md)                          | `docs/TRUST-STAFF.md`, `docs/PRODUCT.md`                        | deleted_doc04; owner `docs/TRUST-STAFF.md`; history Git       |
| [docs/handbook/03-FEATURES-AND-SURFACES.md](PROJECT-MAP.md)                          | `docs/PROJECT-MAP.md`                                           | deleted_doc04; owner `docs/PROJECT-MAP.md`; history Git       |
| [docs/handbook/04-TRUST-SAFETY-SECURITY.md](TRUST-STAFF.md)                          | `docs/TRUST-STAFF.md`                                           | deleted_doc04; owner `docs/TRUST-STAFF.md`; history Git       |
| [docs/handbook/05-UX-AND-DESIGN.md](UX-CONTRACT.md)                                  | `docs/UX-CONTRACT.md`                                           | deleted_doc04; owner `docs/UX-CONTRACT.md`; history Git       |
| [docs/handbook/06-BUSINESS-MODEL.md](COMMERCIAL-FUTURE.md)                           | `docs/COMMERCIAL-FUTURE.md`                                     | deleted_doc04; owner `docs/COMMERCIAL-FUTURE.md`; history Git |
| [docs/handbook/08-DOMAIN-AND-DATA-MODEL.md](ARCHITECTURE.md)                         | `docs/ARCHITECTURE.md`                                          | deleted_doc04; owner `docs/ARCHITECTURE.md`; history Git      |
| [docs/handbook/10-ROADMAP.md](ROADMAP.md)                                            | `docs/ROADMAP.md`, `planning/tasks.json`                        | deleted_doc04; owner `docs/ROADMAP.md`; history Git           |
| [docs/handbook/13-DECISION-REGISTER.md](handbook/13-DECISION-REGISTER.md)            | `docs/DECISIONS.md`                                             | merge_after_semantic_review                                   |
| [docs/handbook/15-AI-CONTEXT-INDEX.md](handbook/15-AI-CONTEXT-INDEX.md)              | `docs/PROJECT-MAP.md`                                           | merge_after_semantic_review                                   |
| [docs/handbook/17-DRM-AND-LICENSING.md](COMMERCIAL-FUTURE.md)                        | `docs/COMMERCIAL-FUTURE.md`                                     | deleted_doc04; owner `docs/COMMERCIAL-FUTURE.md`; history Git |
| [docs/handbook/18-COMMERCE-AND-PAYOUT-FLOWS.md](COMMERCIAL-FUTURE.md)                | `docs/COMMERCIAL-FUTURE.md`                                     | deleted_doc04; owner `docs/COMMERCIAL-FUTURE.md`; history Git |
| [docs/handbook/19-COMMUNITY-AND-RETENTION.md](COMMUNITY.md)                          | `docs/COMMUNITY.md`, `docs/RETENTION-PLAN.md`                   | deleted_doc04; owner `docs/COMMUNITY.md`; history Git         |
| [docs/handbook/20-ADMIN-MODERATION-AND-APPEALS.md](TRUST-STAFF.md)                   | `docs/TRUST-STAFF.md`                                           | deleted_doc04; owner `docs/TRUST-STAFF.md`; history Git       |
| [docs/handbook/21-REPUTATION-VERIFICATION-AND-REVIEWS.md](COMMUNITY.md)              | `docs/TRUST-STAFF.md`, `docs/COMMUNITY.md`                      | deleted_doc04; owner `docs/COMMUNITY.md`; history Git         |
| [docs/handbook/22-SUBSCRIPTIONS-PROMOTION-AND-MONETIZATION.md](COMMERCIAL-FUTURE.md) | `docs/COMMERCIAL-FUTURE.md`                                     | deleted_doc04; owner `docs/COMMERCIAL-FUTURE.md`; history Git |
| [docs/handbook/23-MARKETPLACE-PRODUCT-LIFECYCLE.md](RESOURCES.md)                    | `docs/RESOURCES.md`                                             | deleted_doc04; owner `docs/RESOURCES.md`; history Git         |
| [docs/handbook/24-SERVERS-ORGANIZATIONS-AND-PROFILES.md](SERVERS-ORGS.md)            | `docs/SERVERS-ORGS.md`                                          | deleted_doc04; owner `docs/SERVERS-ORGS.md`; history Git      |
| [docs/handbook/25-DEALS-SERVICES-AND-GUARANTEE.md](COMMERCIAL-FUTURE.md)             | `docs/COMMERCIAL-FUTURE.md`                                     | deleted_doc04; owner `docs/COMMERCIAL-FUTURE.md`; history Git |
| [docs/handbook/26-SEARCH-RANKING-ADS-AND-PERSONALIZATION.md](UX-CONTRACT.md)         | `docs/UX-CONTRACT.md`, `docs/COMMERCIAL-FUTURE.md`              | deleted_doc04; owner `docs/UX-CONTRACT.md`; history Git       |
| [docs/handbook/27-MESSAGING-GROUPS-AND-SOCIAL-SYSTEMS.md](COMMUNITY.md)              | `docs/COMMUNITY.md`, `docs/TRUST-STAFF.md`                      | deleted_doc04; owner `docs/COMMUNITY.md`; history Git         |
| [docs/handbook/28-CART-LICENSES-AND-ACCESS-RIGHTS.md](RESOURCES.md)                  | `docs/RESOURCES.md`, `docs/COMMERCIAL-FUTURE.md`                | deleted_doc04; owner `docs/RESOURCES.md`; history Git         |
| [docs/handbook/29-SUPPORT-TRIAL-WISHLIST-AND-BILLING-UX.md](FLOWS.md)                | `docs/FLOWS.md`, `docs/COMMERCIAL-FUTURE.md`                    | deleted_doc04; owner `docs/FLOWS.md`; history Git             |
| [docs/handbook/30-SERVER-OWNERSHIP-STATUS-AND-JOIN.md](SERVERS-ORGS.md)              | `docs/SERVERS-ORGS.md`                                          | deleted_doc04; owner `docs/SERVERS-ORGS.md`; history Git      |
| [docs/handbook/31-ORGANIZATION-COMMERCE-AND-MESSAGING-POLICY.md](SERVERS-ORGS.md)    | `docs/SERVERS-ORGS.md`, `docs/COMMERCIAL-FUTURE.md`             | deleted_doc04; owner `docs/SERVERS-ORGS.md`; history Git      |
| [docs/handbook/32-LAUNCH-ONBOARDING-AND-PRODUCTION-GATES.md](PRODUCT.md)             | `docs/PRODUCT.md`, `docs/OPERATIONS.md`, `docs/RELEASE-PLAN.md` | deleted_doc04; owner `docs/PRODUCT.md`; history Git           |
| [docs/handbook/33-WORKSPACE-DASHBOARDS-AND-LIBRARY.md](RESOURCES.md)                 | `docs/RESOURCES.md`, `docs/UX-CONTRACT.md`                      | deleted_doc04; owner `docs/RESOURCES.md`; history Git         |
| [docs/handbook/34-PRODUCT-PAGE-DEPENDENCIES-AND-DELIVERY.md](RESOURCES.md)           | `docs/RESOURCES.md`, `docs/FLOWS.md`                            | deleted_doc04; owner `docs/RESOURCES.md`; history Git         |
| [docs/handbook/35-SECURITY-CENTER-QUARANTINE-ADMIN-AND-API.md](TRUST-STAFF.md)       | `docs/TRUST-STAFF.md`, `docs/ARCHITECTURE.md`                   | deleted_doc04; owner `docs/TRUST-STAFF.md`; history Git       |
| [docs/handbook/36-IDENTITY-PROFILES-AND-VERIFIED-LINKS.md](COMMUNITY.md)             | `docs/COMMUNITY.md`, `docs/TRUST-STAFF.md`                      | deleted_doc04; owner `docs/COMMUNITY.md`; history Git         |
| [docs/handbook/37-HOME-DISCOVER-NAVIGATION-AND-FEEDS.md](PRODUCT.md)                 | `docs/UX-CONTRACT.md`, `docs/PRODUCT.md`                        | deleted_doc04; owner `docs/PRODUCT.md`; history Git           |
| [docs/handbook/38-ACCOUNT-AUTH-AND-LIFECYCLE.md](TRUST-STAFF.md)                     | `docs/TRUST-STAFF.md`, `docs/FLOWS.md`                          | deleted_doc04; owner `docs/TRUST-STAFF.md`; history Git       |
| [docs/handbook/39-SELLER-PUBLISHING-KYC-AND-CATALOG-STATES.md](RESOURCES.md)         | `docs/RESOURCES.md`, `docs/COMMERCIAL-FUTURE.md`                | deleted_doc04; owner `docs/RESOURCES.md`; history Git         |
| [docs/handbook/40-STAFF-CASEWORK-GOVERNANCE-AND-QUEUES.md](TRUST-STAFF.md)           | `docs/TRUST-STAFF.md`                                           | deleted_doc04; owner `docs/TRUST-STAFF.md`; history Git       |
| [docs/handbook/41-PWA-THEMES-ACCESSIBILITY-AND-NOTIFICATIONS.md](UX-CONTRACT.md)     | `docs/UX-CONTRACT.md`, `docs/FLOWS.md`                          | deleted_doc04; owner `docs/UX-CONTRACT.md`; history Git       |
| [docs/handbook/42-ANALYTICS-PRIVACY-RETENTION-AND-ACTIVITY-LOG.md](TRUST-STAFF.md)   | `docs/TRUST-STAFF.md`, `docs/RETENTION-PLAN.md`                 | deleted_doc04; owner `docs/TRUST-STAFF.md`; history Git       |
| [docs/handbook/43-ROLE-SURFACE-MAP.md](PROJECT-MAP.md)                               | `docs/PROJECT-MAP.md`                                           | deleted_doc04; owner `docs/PROJECT-MAP.md`; history Git       |
| [docs/handbook/44-GUEST-HOME-DISCOVER-SCREENS.md](UX-CONTRACT.md)                    | `docs/UX-CONTRACT.md`                                           | deleted_doc04; owner `docs/UX-CONTRACT.md`; history Git       |
| [docs/handbook/45-USER-PROFILE-COMMUNITY-SCREENS.md](COMMUNITY.md)                   | `docs/COMMUNITY.md`, `docs/FLOWS.md`                            | deleted_doc04; owner `docs/COMMUNITY.md`; history Git         |
| [docs/handbook/46-BUYER-CART-PURCHASE-LIBRARY-SCREENS.md](RESOURCES.md)              | `docs/RESOURCES.md`, `docs/FLOWS.md`                            | deleted_doc04; owner `docs/RESOURCES.md`; history Git         |
| [docs/handbook/47-SELLER-CREATOR-SCREENS.md](RESOURCES.md)                           | `docs/RESOURCES.md`                                             | deleted_doc04; owner `docs/RESOURCES.md`; history Git         |
| [docs/handbook/48-SERVER-OWNER-SCREENS.md](SERVERS-ORGS.md)                          | `docs/SERVERS-ORGS.md`                                          | deleted_doc04; owner `docs/SERVERS-ORGS.md`; history Git      |
| [docs/handbook/49-ORGANIZATION-SCREENS.md](SERVERS-ORGS.md)                          | `docs/SERVERS-ORGS.md`                                          | deleted_doc04; owner `docs/SERVERS-ORGS.md`; history Git      |
| [docs/handbook/50-STAFF-OPERATIONS-SCREENS.md](TRUST-STAFF.md)                       | `docs/TRUST-STAFF.md`                                           | deleted_doc04; owner `docs/TRUST-STAFF.md`; history Git       |
| [docs/handbook/51-PRICING-SUBSCRIPTIONS-ERROR-OFFLINE-UX.md](COMMERCIAL-FUTURE.md)   | `docs/UX-CONTRACT.md`, `docs/COMMERCIAL-FUTURE.md`              | deleted_doc04; owner `docs/COMMERCIAL-FUTURE.md`; history Git |
| [docs/handbook/52-PLAN-ECONOMICS-COMMISSION-AND-HOLDS.md](COMMERCIAL-FUTURE.md)      | `docs/COMMERCIAL-FUTURE.md`                                     | deleted_doc04; owner `docs/COMMERCIAL-FUTURE.md`; history Git |
| [docs/handbook/53-TRUST-PUBLIC-HISTORY-AND-CONTENT-MODERATION.md](TRUST-STAFF.md)    | `docs/TRUST-STAFF.md`                                           | deleted_doc04; owner `docs/TRUST-STAFF.md`; history Git       |
| [docs/handbook/54-LICENSE-MODELS-FORENSICS-AND-REVOCATION.md](COMMERCIAL-FUTURE.md)  | `docs/COMMERCIAL-FUTURE.md`                                     | deleted_doc04; owner `docs/COMMERCIAL-FUTURE.md`; history Git |
| [docs/handbook/55-PRODUCTION-STORAGE-SCANNERS-AND-OBSERVABILITY.md](ARCHITECTURE.md) | `docs/OPERATIONS.md`, `docs/ARCHITECTURE.md`                    | deleted_doc04; owner `docs/ARCHITECTURE.md`; history Git      |
| [docs/handbook/56-SUPPORT-SLA-AND-DISPUTE-TIMING.md](TRUST-STAFF.md)                 | `docs/TRUST-STAFF.md`, `docs/COMMERCIAL-FUTURE.md`              | deleted_doc04; owner `docs/TRUST-STAFF.md`; history Git       |
| [docs/handbook/57-PLANS-QUOTAS-AND-ADMIN-CONFIG.md](COMMERCIAL-FUTURE.md)            | `docs/COMMERCIAL-FUTURE.md`, `docs/TRUST-STAFF.md`              | deleted_doc04; owner `docs/COMMERCIAL-FUTURE.md`; history Git |

## Приёмка переноса

Для каждой главы сравнить цели, права, happy path, существенные ошибки, состояния, лимиты, исключения и operator commands. Стабильные ID сохраняются. У каждого удаляемого пути есть проверенные новые ссылки и отсутствие программного потребителя. Действующие миграции, fixtures, lockfile и инструменты не становятся «мусором» из-за возраста или имени.

Ни один исходный файл в этом пакете не помечен как разрешённый к немедленному удалению. Реальный deletion manifest появляется по результату DOC-04.
