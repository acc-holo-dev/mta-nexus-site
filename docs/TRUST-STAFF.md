# Доверие, безопасность, staff и аккаунт

**Статус:** предметный контракт DOC-05 (semantic merge). База сверки: `385e577e7443cf7d7b817419ce5c3b8afe87b690`. Полный текст исходных решений остаётся в [реестре](handbook/13-DECISION-REGISTER.md); NX-дополнения — в [DECISIONS.md](DECISIONS.md). Удаление handbook-глав — только DOC-04 после проверки потребителей.

**Метки состояния смысла** (обязательны при чтении и доработке):

| Метка                | Значение                                                                          |
| -------------------- | --------------------------------------------------------------------------------- |
| **текущий runtime**  | Подтверждено кодом/схемой/проверками на указанном SHA; не равно production deploy |
| **цель владельца**   | Утверждённый owner-target; реализация и включение — отдельные состояния           |
| **предложение**      | Направление без разрешения на build без отдельной команды владельца               |
| **живой неизвестно** | Нужны свидетельства с целевой среды или контролируемый repro                      |

**Жёсткие инварианты.** Сессию, роль, принадлежность и capability проверяет сервер; скрытая кнопка не заменяет проверку. Приватные данные, внутренние ошибки, секреты, raw evidence и provider payloads не становятся публичными DTO/логами/отчётами. Критическое изменение и обязательный аудит — атомарны. Для критичных staff-действий сохраняется требование fresh-auth / step-up (минимум `staff_action` → `current_password`); **2FA добровольна** и не становится обязательной только из-за роли Seller / Server Owner / Organization Finance / Staff. Операторские команды, mail/recovery, ClamAV и recovery inbox — в [OPERATIONS.md](OPERATIONS.md); этот документ их не переписывает.

Смежные контракты: сценарии — [FLOWS.md](FLOWS.md); UI — [UX-CONTRACT.md](UX-CONTRACT.md); архитектура выдачи/сканирования — [ARCHITECTURE.md](ARCHITECTURE.md); сроки хранения — [RETENTION-PLAN.md](RETENTION-PLAN.md) и § privacy ниже; коммерция/DRM/планы — `COMMERCIAL-FUTURE.md`; сообщество/профиль UX — `COMMUNITY.md`; серверы/org — `SERVERS-ORGS.md`. Полный messaging/groups/DM остаётся в COMMUNITY; здесь — только границы abuse/модерации.

---

## 1. Роли и полномочия

**текущий runtime.** В `users.role`: `user`, `developer`, `server_owner`, `moderator`, `admin`. Проверки сессии/прав — в `packages/security` и сервисах/репозиториях; поля — в схеме БД.

| Контекст         | Граница доступа                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| Гость            | Безопасные публичные поля и опубликованные объекты; приватная библиотека, evidence и управление недоступны        |
| Пользователь     | Собственный аккаунт, сессии, настройки, разрешённые взаимодействия и полученные права                             |
| Автор            | Ресурсы текущего владельца; публикация — через проверки артефакта и модерации                                     |
| Владелец сервера | Управление подтверждённым объектом; контроль endpoint и владение проверяются отдельно                             |
| Организация      | Действующее членство и конкретные permissions; смена контекста повторно проверяет членство и атомарно пишет аудит |
| Staff            | Разрешённое действие над разрешённой областью; причины, evidence и аудит зависят от операции                      |

Историческое авторство не сохраняет доступ после передачи объекта или отзыва членства. Чтение, изменение, финансовый доступ и просмотр приватных материалов проверяются **отдельно**. Критические изменения повторно проверяют права внутри транзакции.

**цель владельца.** Staff-полномочия **накапливаются** (many-to-many / capability grants), а не ограничиваются одним взаимоисключающим enum:

| Область                     | Специализация                                                                      |
| --------------------------- | ---------------------------------------------------------------------------------- |
| Support                     | Обращения и разрешённые действия помощи                                            |
| Community / Content         | Сообщество, публикации, editorial                                                  |
| Resource / Server           | Артефакты, ресурсы, серверные страницы, владение                                   |
| Verification                | Доказательства, подтверждение и отзыв статуса                                      |
| Finance / Disputes          | Возвраты, споры, сверка провайдера, выплаты; **финансовая роль не даёт модерации** |
| Security / Trust            | Расследования, злоупотребления, санкции                                            |
| Administrator / Super Admin | Операционное управление и отдельно защищённые исключительные действия              |

Отдельная capability нужна для финансов, raw provider payloads, приватного evidence и опасных операций. Допустимо ограничение отдельных возможностей аккаунта без полного бана. Подписка **не** выдаёт staff-права и **не** отменяет санкции. Seller и Buyer — возможности сценария, не отдельные аккаунты; отдельное ручное seller-одобрение не обязательный входной барьер. Карта поверхностей ролей — [43-ROLE-SURFACE-MAP](PROJECT-MAP.md) до переноса в PROJECT-MAP.

---

## 2. Семантика доверия и обязательные границы безопасности

**цель владельца / продуктовый смысл технических границ** (детали выдачи и сканеров — ARCHITECTURE + OPERATIONS):

- Публичный build опубликован, имеет **чистую** проверку с provenance сканера и временем. Таймаут, отсутствие сканера и неполная проверка ≠ clean. ClamAV должен сообщать о превышении лимитов через `AlertExceedsMax` (конфиг — OPERATIONS).
- Файлы приватны, ключи неизменяемы; размер и SHA-256 проверяются при передаче; отмена освобождает чтение; ошибка целостности блокирует выдачу.
- Сервер проверяет сессию, владельца, контекст и разрешения; browser mutation — происхождение; публичный URL-валидатор ≠ SSRF-защита серверного запроса.
- Приватные ответы не кэшируются публично. Пароли, токены, секреты сессий, ключи лицензий и raw evidence не попадают в публичные DTO, логи или отчёты.
- Критические изменения и обязательный аудит транзакционны. Событие описывает известный факт: начало скачивания ≠ завершённое скачивание.
- Подписка, платная публикация, высокий trust и verification **не** обходят hard safety/finance controls, rate limits и проверки артефакта.

| Факт                               | Значение                                                                                       |
| ---------------------------------- | ---------------------------------------------------------------------------------------------- |
| Контроль endpoint / внешней ссылки | Доказано конкретное управление; не качество сервера/автора и не универсальное одобрение        |
| Verification                       | Подтверждено конкретное свойство по evidence; пересматриваемо; **нельзя купить**               |
| Отзыв                              | Допустимое взаимодействие и контекст версии/покупки; право оставить отзыв проверяется отдельно |
| Репутация                          | Несколько доказуемых сигналов и история, не один непрозрачный платный score                    |
| Жалоба                             | Вход для расследования, не публичный обвинительный вердикт                                     |
| Malware clean                      | Результат конкретной проверки; не абсолютная безопасность и не отмена повторной авторизации    |

---

## 3. Аккаунт, аутентификация и жизненный цикл

### 3.1 Гость и вход

**цель владельца.** Без аккаунта — чтение разрешённых public surfaces (Home/Discover, public servers/resources, public profiles, community topics/articles/events, archived/delisted если не скрыты security/legal). Login нужен для state-changing actions.

**текущий runtime.** Основной вход — **email + password**. Social networks **не** login providers на этом этапе (**цель владельца** подтверждает границу).

Обязательные примитивы безопасности (**цель владельца**; часть уже в runtime — sessions, recovery, security settings по OPERATIONS/browser smoke): secure password hashing; email verification; password reset/recovery; listing/revocation сессий; optional 2FA + recovery codes; re-auth для чувствительных действий; rate limits; Activity & Security Log (log — **цель владельца**, см. § privacy).

### 3.2 Email verification gate

**цель владельца.** Подтверждённый email нужен почти для всех state-changing public действий: comments/forum/content; follows; free claim; trial; purchase/checkout; resource publishing; server claim; DMs/support; organization/server invitations и ownership-sensitive действия. Гость и unverified могут читать разрешённые public surfaces. Исключения recovery/support/security проектируются явно, без deadlock.

### 3.3 2FA и Security Center

**цель владельца.** Отдельный Security Center: active sessions; devices/session metadata; login history; password/security events; 2FA + recovery codes; session revoke; suspicious-login/security alerts; future API credentials (если capability запущена); account recovery state.

**OWNER DECISION:** 2FA **не обязательна** только из-за роли Seller / Server Owner / Organization Finance / Staff. Интерфейс настойчиво рекомендует 2FA для high-value/high-risk; PSP/provider или incident могут требовать step-up; sensitive actions могут требовать re-auth **независимо** от 2FA; платформа может пересмотреть mandatory-2FA позже по abuse data. Нельзя блокировать базовую роль только отсутствием 2FA, если иной policy/legal/provider gate этого не требует.

**текущий runtime / живой неизвестно.** Policy `staff_action` → `current_password` существует (`packages/security` fresh-auth); PROBLEMS F09: HTTP→transaction enforcement для admin actions ещё нужно закрыть до public beta. Добровольная 2FA остаётся отдельной возможностью (FLOWS FLOW-22). Финальная действительность initiating session в длинных upload/download — F08 (**живой неизвестно** / issue до beta).

Конфигурация ключей, TLS, outbox и восстановления почты — **только** [OPERATIONS.md](OPERATIONS.md). Состояние очереди ≠ доказанная доставка.

### 3.4 Удаление аккаунта и archival

**цель владельца.** Пользователь не обязан вручную обходить все сущности. Система переводит personal-owned сущности в безопасный archive/inactive там, где применимо:

- personal draft/resources/server-owned без alternate owner — архивируются;
- co-owned/organization не уничтожаются из-за одного участника; ownership resolution по remaining owners/policy;
- active deals/payment/disputes → controlled closure/retention;
- audit/security/payment/legal records сохраняются на необходимый срок;
- public profile → deleted/archived identity presentation;
- username entitlement — по vanity policy;
- private personal data удаляется/анонимизируется, где retention не требует хранения.

Deletion — workflow, не каскадный `DELETE FROM users`. Рекомендуемые состояния: `ACTIVE → SUSPENDED → DELETION_REQUESTED → ARCHIVING → ARCHIVED/DELETED_PRESENTATION`. Financial/legal/security holds могут задерживать физическое удаление отдельных записей, но не хранят лишнее бессрочно.

**OWNER DECISION:** self-service `Export my data` **не** product requirement сейчас; legal access requests в применимых юрисдикциях могут существовать без export UI.

---

## 4. Identity, анти-имитация и verified links (trust)

**цель владельца.**

- Неизменяемый внутренний/public-stable **User ID** — главный identity anchor; не зависит от подписки и vanity.
- Обычный пользователь изначально может существовать публично под ID; подписка может открыть **vanity username** (монетизация — COMMERCIAL-FUTURE; здесь — trust-границы).
- Vanity: unique; reserved-name/impersonation checks; **не** заменяет ID в audit/security/payment; **не** даёт verification; **не** копирует staff/verified visual identity; смена — отдельная платная операция; после окончания entitlement — **7-дневный grace/reservation**, затем slug освобождается; потеря vanity **не** разрушает immutable identity/audit. Historical audit/payment/moderation references **не** переписываются под новый username. Staff search всегда по immutable ID; historical presentation — evidence/audit metadata.
- Профиль нового пользователя по умолчанию **публичный**, но только поля, предназначенные для публичного профиля (ID/vanity, avatar/banner, bio, badges/verification, public orgs/resources/servers, selected achievements, public posts/activity where allowed, verified external links). **Никогда** автоматически: email, payment history, private purchases, IP/device/session, moderation evidence, private org membership.
- Customization не имитирует trust badges, staff UI, warning banners, SCAM/verification labels. Decorative Pro themes не должны визуально перебивать trust badges.
- Verified external links (GitHub, Discord, website/domain и т.п.): доказанное владение внешней точкой ≠ endorsement качества. Методы: OAuth/account proof; DNS TXT; signed/tokenized challenge; provider-specific bot/challenge. Не просить secrets/API tokens в profile. OAuth/challenge для подтверждения владения **не** становятся автоматически альтернативным login.
- UI всегда различает: immutable User ID; vanity; verified external account; platform verification badge; staff status; organization identity.
- Нельзя монетизировать как cosmetic: Verified Seller/Developer/Server/Organization; Clean Build; staff status; SCAM removal; review authenticity.

---

## 5. Verification, репутация и отзывы (trust)

**Текущая подача заявки.** `POST /api/workspace/verification` требует заголовок `X-Nexus-Actor-Id` с ID исходного пользователя; клиентам API необходимо его передавать. При неизвестном результате форма сохраняет исходные доказательства в текущей вкладке и допускает только точный повтор. Ответ о существующей заявке подтверждает лишь наличие заявки на эту цель, а не её автора или содержимое.

**цель владельца.** Три раздельных понятия; ни одно нельзя купить как истину:

1. **Verification** — evidence-backed подтверждение конкретного claim/status.
2. **Reputation** — много независимых behavioral/history сигналов.
3. **Reviews** — feedback при доказуемой eligibility.

**Репутация.** Несколько сигналов, не один opaque score. Кандидаты: account age; verified identity/ownership; completed paid orders; successful resource history; fulfilled services/projects; ratings distribution; verified server interaction; dispute/refund history с осторожным контекстом; moderation violations/sanctions; response/support behavior; portfolio/public project history; linked proof; org/server ownership track record. Composite UI summary может появиться позже; исходные сигналы должны оставаться достаточно inspectable.

**Verification.** Не платный продукт. Типы (User/Identity, Developer, Seller, Organization, Server, specialized programs). Candidate evidence для Developer/Seller: meaningful history; successful sales/orders/projects; нет unresolved severe violations; portfolio/public source; manual review when needed. Пороги configurable и type-specific. Payment/subscription ≠ evidence. Некоторые типы могут expire/revalidate; revoked/expired — auditable state change, без silent rewrite. Appeal для rejected/revoked: доп. evidence, сохранение original decision, independent review where practical.

**Review eligibility.**

- paid resource: только verified purchaser/entitled buyer;
- free resource: только recorded claim/download/eligible interaction;
- server reviews: later — verified interaction, не drive-by (**текущий runtime** уже имеет verified-interaction server reviews в линии feat/trust — сверять код; смысл цели сохранён).

UI помечает evidence class (`Verified Purchase`, `Claimed Resource`, …), не endorsement NEXUS. Reviewer может обновить отзыв (в т.ч. после новой версии) с timestamps и предпочтительно edit history/version context. Модерация отзывов: spam, conflict of interest, abuse, extortion, impersonation, non-product, policy; негативный легитимный feedback не снимается по желанию продавца.

**Badges (цель владельца):** Verified User/Developer/Seller/Server/Organization; Clean Build; DRM Protected; Verified Purchase Review; Verified Server Interaction; Official/Staff — у каждого documented meaning.

---

## 6. Quarantine, malware, admin search и API policy

### 6.1 Quarantine и malware response

**цель владельца.** Отдельный state/action `Quarantine` для подозрительного resource/build немедленно останавливает: download; activation/lease для affected build; promotion/featured; automatic publication/rollout. Артефакт **не** удаляется автоматически — evidence с ограниченным staff access, audit и reason. Отличается от permanent rejection/takedown; может быть снята после проверки.

При подтверждённом malware/security incident: определить пользователей, получивших affected build, и уведомить (product/build/version; severity/status; stop/remove/update; safe replacement если есть; timestamp; support/security contact; transparency reason если безопасно). Нельзя ограничиваться takedown каталога: downstream exposure — отдельная incident-response задача.

**текущий runtime.** Карантин, report-decision projection и build-incident delivery для downloaders с opt-in уже развивались в линии SEC-00x (см. PROBLEMS / OPERATIONS recovery inbox). Subscription никогда не ослабляет quarantine/malware. Решения должны достигать cached/private delivery paths, не только скрывать UI card. Полный production-контур уведомлений и coverage всех кэшей — **живой неизвестно** до свидетельств среды.

### 6.2 Global admin/case search

**цель владельца.** Permission-aware global search: User ID / vanity; Server ID / endpoint; Resource/Product/Build; Order / item; Payment/provider ref; License/entitlement; dispute/case/report; IP/technical indicator where permission + retention позволяют; audit event ID. Результаты показывают связи, но не раскрывают finance/security без capability. Sensitive lookup может быть auditable.

### 6.3 Raw payment/provider data

**OWNER DECISION:** Finance по умолчанию работает с **normalized** payment model. Raw provider payload: не всем finance/moderation; отдельная restricted debug capability; желателен audit каждого открытия; secrets/signatures/full card/bank не в UI; retention/redaction по provider/legal/security.

### 6.4 API keys, public API, status page

**OWNER DECISION:**

- self-service API keys/webhooks **не** обязательны для первой commercial release (долгосрочная capability: scoped credentials, rotation/revocation, audit, rate limits, webhook signing, event versioning, least privilege, personal/org separation);
- на первом этапе **не** открывать анонимный read-only API всему интернету; при появлении — authenticated partners/Pro/integrations; internal APIs ≠ public compatibility; scraping ≠ API contract;
- отдельная публичная Status Page NEXUS **не** требуется сейчас; internal observability/alerts/incident records обязательны для production (OPERATIONS / observability).

### 6.5 Security invariants (сводка)

- finance access ≠ automatic moderation;
- raw provider — restricted;
- staff search permission-aware;
- audit events неизменяемы приложением без специальной maintenance procedure;
- security actions server-authoritative;
- step-up/re-auth для ownership/payout/finance privilege changes и иных risk-model действий — **независимо** от optional 2FA.

---

## 7. Модерация, санкции, SCAM/BLACKLIST, апелляции

**текущий runtime.** Есть reports, moderation cases, verification и build review concepts плюс `/admin` очереди (support, reports, resources, …).

**цель владельца.** Администрирование — специализированные operational departments, не один undifferentiated super-user screen. Рекомендуемые секции: Overview; Users & Accounts; Resources & Builds; Servers & Ownership; Community & Content; Reports & Abuse; Verification; Trust / SCAM / Blacklist; Payments/Refunds/Disputes; Subscriptions & Entitlements; Advertising/Promotion; Notifications; Security & Audit; Platform configuration (узкий privilege). Departments могут делить queues и case entities; избегать дублирующих disconnected систем.

### 7.1 Case record

High-value case сохраняет: target entity; reporter/source; evidence refs; reason codes; private staff notes; public reason when applicable; assigned staff/team; state changes; actions; notifications; appeal link; audit. Рекомендуемые состояния: `open → triaged → investigating → actioned | no_action → appealable/closed`; appeal — отдельный объект/состояние.

Единый timeline (append-oriented; исправление = новое событие):

```text
report → evidence → triage → investigation → action → affected-user response
      → appeal → review → final decision → public reason / closure
```

Каждое действие: actor, timestamp, capability, reason, affected entities.

### 7.2 Аудитории заметок

Явная audience class: `INTERNAL` | `VISIBLE_TO_AFFECTED_USER` (или `VISIBLE_TO_USER`) | `PUBLIC_REASON`. Conversion между audiences — explicit action, не automatic copy из internal note.

### 7.3 Санкции

Capability-scoped лестница: warning → content removal/unpublish → feature restriction → temporary suspension → permanent ban → high-severity public trust label where policy permits. Тяжесть/evidence могут требовать немедленного строгого действия (malware/fraud). Пример: потеря selling rights при сохранении ordinary community access.

### 7.4 SCAM / BLACKLIST

**OWNER DECISION:** controlled platform verdict, не user-created label и не crowd vote. Достаточно **одного** authorized senior Trust/Admin с capability. Обязательны: evidence; immutable/auditable decision; substantive public reason с redaction safety (PII, exploit/security details, protected evidence); appeal path; actor/time; later reversal/review history. Два approvals **не** обязательны. Публичный UI: reason, date/status, appeal availability. Никогда — free-form public accusation board.

### 7.5 Appeals

**OWNER DECISION:** обязательны для bans/sanctions, content moderation, verification decisions и eligible platform dispute outcomes. Сохраняют original decision + новый review trail. High-severity — reviewer separation where possible. Outcomes: `upheld` | `modified` | `overturned`.

### 7.6 Transparency и audit

Default: публичное enforcement имеет публичную substantive reason. Private-only cases допустимы, если публикация раскрыла бы private user info, security internals или legally protected material. Privileged mutation: actor, target, capability, action, reason, request/correlation id, resulting state. Finance, trust labels, verification и destructive actions — особенно сильный audit retention.

### 7.7 Anti-abuse и staff safety

- нет silent moderator impersonation;
- нет one-click destructive bulk без safeguards;
- separate view vs mutate для sensitive evidence/finance where useful;
- rate-limit / step-up для especially sensitive actions;
- staff не покупает/не обходит verification outcomes;
- subscription не shields от moderation.

### 7.8 Financial correction governance

**OWNER DECISION:** крупные refunds/manual payout corrections **не** требуют обязательного второго staff approval как universal rule. Требуются: Finance capability; provider authorization; re-auth where risk; exact amount/currency/reference; audit; idempotency/reconciliation; provider/legal limits. Dual-control может быть добавлен позже для конкретного provider/threshold — не текущий product invariant.

---

## 8. Staff casework, очереди и support concurrency

### 8.1 Очереди и приоритеты

**цель владельца.** Case categories: malware/security; scam/trust; content/resource moderation; verification; payment/settlement; dispute/refund; appeal; account/server/organization ownership.

Минимум очередей: (1) Critical Malware/Security; (2) Payment/Settlement; (3) SCAM/Trust; (4) Appeal; (5) Normal Content/Reports. Engine: severity/priority; assignment; age/SLA target; escalation; dependency; bulk filters **не** blind bulk actions; audit. Exact SLA minutes/hours — позднее по capacity (**живой неизвестно** / задаётся операционно, не как публичный контракт).

### 8.2 Support: реализованные concurrency/idempotency (**текущий runtime**)

Из главы 40 — действующие контракты кода:

- Staff `PATCH /api/support/:id`: `status` + `expectedStatus`; mismatch → private `409 SUPPORT_STATUS_CONFLICT`, reload, без audit/notification; matching no-op idempotent; real change — PostgreSQL compare-and-set в audit transaction. Precondition сравнивает status, не immutable revision; полный ABA `open→resolved→open` не детектится (**остаток**/предложение усиления revision token).
- Staff queue filter по status/category; customer view — requester-scoped; validated query; consistent count/page; composite index; RU/EN; смена фильтра сбрасывает pagination; stale list fetches aborted. Это browsing, не assignment/adjudication.
- `POST /api/support/:id` reply: `expectedStatus`; stale → `SUPPORT_MESSAGE_CONFLICT`; closed → `SUPPORT_CASE_CLOSED`; сознательный reply на resolved может reopen атомарно с message+audit. Browser: refresh thread, preserve unsent text, localized conflict; retry explicit.
- `SupportCaseRepository.updateStatus` требует `expectedStatus`; нет unconditional fallback. Thread pagination cancels obsolete GETs. Page switch disabled while reply/status pending.
- JSON mutations ≤ 32 KiB streamed bytes; oversized → `413 SUPPORT_BODY_TOO_LARGE` без write; invalid JSON/UTF-8 rejected; Zod field limits; single-flight client forms.
- Create/reply: canonical UUIDv4 `Idempotency-Key`; SHA-256 fingerprint нормализованных полей; DB key `(actor_id, request_key)`; mismatch → `SUPPORT_IDEMPOTENCY_CONFLICT`; reservation+mutation+audit в одной транзакции; replay → 201 `replayed: true`. Key не авторизует доступ сам по себе; session + ownership/moderation capability сначала. Migration `0033_support_mutation_idempotency`.
- Reload-safe retry keys в sessionStorage (UUID, digest, reply status, expiry; без subject/message content); 24h; cross-tab/logout guarantee **не** verified (**живой неизвестно** / PROBLEMS).

**FLOWS.** Support приватен и idempotent; requester open↔resolved; closed — staff; reply в resolved reopen; лимиты 5 новых/час и 30 replies/час. FLOW-19 — проверенный resource/build/receipt context (**цель** расширения).

---

## 9. Staff operations screens

**цель владельца.**

**Staff Home.** Role-aware dashboard: assigned cases; SLA/escalation alerts; critical incidents; queue counters; recent high-risk actions; workload; quick search. Priority queues: Critical Malware / Payment / Scam / Appeal / Normal Content.

**Case detail.** (1) Entity/case summary; (2) evidence + unified timeline; (3) action/reason panel. Notes: Internal / Visible to user / Public reason.

**Impact preview** перед high-impact (sanction, quarantine, refund): users affected; downloads/build availability; licenses/activations; payments/refunds; notifications; public status/reason. Это operator safety layer, **не** замена authorization.

**Границы Support:** purchase/license/product context для помощи; raw PSP и internal Trust notes — отдельные capabilities.

**Границы Finance:** orders/payments/refunds/payouts/finance disputes; **не** меняет content/moderation verdicts без соответствующей moderation capability; raw provider — restricted debug + audit.

**Moderator / Trust:** специализированные очереди; quarantine без физического удаления evidence; один senior Trust/Admin для SCAM/BLACKLIST при обязательных evidence/audit/public reason/appeal.

**Super Admin / System:** emergency controls в отдельной секции `System`: explicit reason; re-auth/step-up; capability; immutable audit; impact preview where meaningful. Не смешивать с ordinary content moderation navigation.

---

## 10. Публичная история доверия и контент-модерация

**цель владельца.** Trust — коллекция verifiable signals, не opaque score. Публичный профиль: вкладка `Trust / Reputation` с public-safe сигналами (verified relationships; verified external links; account age/history where safe; число completed successful sales/deals; verified purchase reviews; verified server interaction; badges с реальными criteria; finalized public moderation actions + current state; SCAM/BLACKLIST where policy). Не раскрывать: private purchase values, payouts, internal notes, raw reports, security evidence.

**Публичная moderation history сохраняется** (не стирается при истечении warning). Lifecycle states, например: `active`, `expired`, `resolved`, `overturned_on_appeal`, `reduced_on_appeal`, `superseded`, `blacklisted`, `blacklist_removed` (если policy позволит). Expired/overturned не должны выглядеть как active.

**Контент-гейты:**

- первый forum topic нового аккаунта — premoderated; после healthy history — immediate publish + automated checks/rate limits/reports/post-moderation;
- articles/guides (owner delegated design): new/low-trust — premoderation; established — immediate + post-moderation; risk flags снова force premoderation; staff может отозвать fast-publish;
- claimed-server news/devlogs — immediate при valid ownership/context, без active risk flag, с automated checks; остаётся reportable;
- events/contests — eligible actors (verified users, claimed servers, orgs, staff); capability-based, не чисто badge; selective moderation по risk;
- **каждый** paid ad / boost / featured creative — content-policy approval до показа; оплата ≠ policy bypass; organic ≠ sponsored.

**Лимиты на каждом trust level.** Trust может повышать safe quotas (DM requests, topics/posts/comments, uploads, publication frequency, selected automation), но **никогда** unlimited. Finance/security/high-impact остаются hard-limited. Progressive anti-abuse для новых/low-trust (DMs, mentions, posts, reviews, submissions, external links) — через age, verified email/security, healthy history и policy signals, **не только оплату**.

Public Trust history стыкуется с case timeline; публичный слой — только safe/public; internal evidence/notes — capability-restricted.

---

## 11. Privacy, retention и Activity Log (trust/security)

**цель владельца.** Analytics может включать product metrics и technical/behavior signals для product, attribution, fraud/abuse, security, reliability. Hidden ≠ secret from policy: категории и цели — в Privacy/Cookie/analytics policy + consent/legal.

Join Server aggregates (owner-facing): click count; approximate unique sessions/users; source/referrer; campaign; timestamp buckets; first-party attribution; fraud-filtered counts. Cross-site/third-party tracking не включается автоматически.

Data minimization: не собирать «на всякий случай» raw player identity/telemetry, hardware fingerprint или unrelated browsing. Security/fraud telemetry отделяется от marketing personalization по purpose, permissions и retention.

**OWNER DECISION:** нет единого срока для всех данных. Retention matrix по типу: auth/session security; audit/moderation; payment/accounting/tax; disputes/chargebacks; malware/security evidence; support attachments; analytics; public content; archived/deleted accounts. Срок = минимально необходимый. Детализация сроков и product retention — [RETENTION-PLAN.md](RETENTION-PLAN.md); этот документ фиксирует trust/privacy принцип.

**User Activity & Security Log:** login/session create/revoke; password/email/2FA changes; recovery; purchases/refunds/disputes; license binding/transfer/activation; server/org ownership changes; critical role/permission changes; security alerts. Не раскрывает internal anti-fraud rules или чувствительные staff notes. Internal audit богаче user log — разные projections одного authoritative history.

---

## 12. Support SLA и timing (staff/support)

**цель владельца.**

- До staffed support organization **не** публиковать hard guaranteed response times, которые нельзя надёжно соблюдать. Priority ordering: critical malware/security → payment/access failures broad impact → active scam/abuse → disputes/appeals → ordinary account/product/community. Internal target times для queue management ≠ contractual public SLA.
- Seller support term (30/90/365 дней и т.п.) ≠ license lifetime ≠ update entitlement ≠ NEXUS platform support ≠ response-time guarantee. Seller не обязан автоматически обещать hours-to-first-response.
- Missed internal dispute handling target **не** значит автоматически buyer wins / seller wins / refund / payout release. Исход — evidence, policy, provider/legal, staff decision.
- Paid plan может улучшать routing/priority **только где advertised**, но **никогда** не покупает: favorable moderation/dispute verdict; verification; removal of valid public sanctions; weaker malware/security review.

Коммерческие dispute/payout детали — `COMMERCIAL-FUTURE.md`.

---

## 13. Messaging: только границы abuse/модерации

Полный DM/groups/events — COMMUNITY. Здесь зафиксированы safety-границы (**цель владельца** / delegated defaults):

- DM минимум включает block/mute, report, attachment policy, anti-spam/rate limits, privacy who-may-message; **staff access только** через defined moderation/legal process, не casual browsing.
- Progressive quotas для low-trust (см. § 10).
- Block — полноценный privacy/safety primitive (DMs/requests, mentions, invites, targeted replies where feasible, персональные рекомендации). Public content moderation и обязательные transaction/legal notices **не** исчезают так, чтобы ломать dispute/audit.
- Private groups: platform moderation override.
- Untrusted HTML/embeds/files — sanitize/validation. Achievements не заменяют verification и не продаются как proof of reputation.
- Security/transactional notices — минимально необходимые, пользователь не отключает их как обычные категории (см. также FLOWS notifications).

---

## 14. Сводка меток (для быстрой сверки)

| Тема                                                                                                 | Метка                                                                                     |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `users.role` enum; `/admin` queues; reports/verification/build review concepts                       | текущий runtime                                                                           |
| Support CAS, filters, body cap, Idempotency-Key, reload-safe keys (с оговорками)                     | текущий runtime                                                                           |
| Quarantine + downloader incident projection (код/линия SEC)                                          | текущий runtime; production coverage — живой неизвестно                                   |
| Fresh-auth policy файл существует                                                                    | текущий runtime; полное HTTP enforcement критичных admin actions — живой неизвестно (F09) |
| Initiating-session на финальных upload/download gates                                                | живой неизвестно (F08)                                                                    |
| Cumulative staff capabilities; specialized departments; formal SCAM/appeal/trust-label UX            | цель владельца                                                                            |
| Security Center полный UX; Activity Log; global staff search; impact preview                         | цель владельца                                                                            |
| 2FA voluntary by role; SCAM one senior Trust/Admin; no universal dual-control finance                | цель владельца (OWNER DECISION)                                                           |
| Public Trust tab + retained public moderation history states                                         | цель владельца                                                                            |
| Email/password primary; social ≠ login; email gate; deletion workflow; no Export-my-data requirement | цель владельца                                                                            |
| Vanity + 7-day grace; verified links; anti-impersonation                                             | цель владельца (монетизация vanity — COMMERCIAL)                                          |
| Self-service API keys / anonymous public API / public Status Page как launch                         | цель владельца: **не** требуется сейчас                                                   |
| Revision token против ABA в support; durable cross-tab idempotency UX                                | остаток / предложение усиления                                                            |
| Exact public SLA minutes                                                                             | не публиковать до capacity; internal targets — цель владельца без контракта               |

---

## Источники DOC-05 (этот контракт)

- [handbook/02-ROLES-AND-PERMISSIONS.md](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/02-ROLES-AND-PERMISSIONS.md) (история; актуальный контракт — этот файл)
- [handbook/04-TRUST-SAFETY-SECURITY.md](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/04-TRUST-SAFETY-SECURITY.md) (история; актуальный контракт — этот файл)
- [handbook/20-ADMIN-MODERATION-AND-APPEALS.md](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/20-ADMIN-MODERATION-AND-APPEALS.md) (история; актуальный контракт — этот файл)
- [handbook/21-REPUTATION-VERIFICATION-AND-REVIEWS.md](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/21-REPUTATION-VERIFICATION-AND-REVIEWS.md) (история; актуальный контракт — этот файл) — trust/verification/reviews eligibility
- [handbook/35-SECURITY-CENTER-QUARANTINE-ADMIN-AND-API.md](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/35-SECURITY-CENTER-QUARANTINE-ADMIN-AND-API.md) (история; актуальный контракт — этот файл)
- [handbook/36-IDENTITY-PROFILES-AND-VERIFIED-LINKS.md](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/36-IDENTITY-PROFILES-AND-VERIFIED-LINKS.md) (история; актуальный контракт — этот файл) — trust/verification/identity
- [handbook/38-ACCOUNT-AUTH-AND-LIFECYCLE.md](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/38-ACCOUNT-AUTH-AND-LIFECYCLE.md) (история; актуальный контракт — этот файл)
- [handbook/40-STAFF-CASEWORK-GOVERNANCE-AND-QUEUES.md](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/40-STAFF-CASEWORK-GOVERNANCE-AND-QUEUES.md) (история; актуальный контракт — этот файл)
- [handbook/42-ANALYTICS-PRIVACY-RETENTION-AND-ACTIVITY-LOG.md](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/42-ANALYTICS-PRIVACY-RETENTION-AND-ACTIVITY-LOG.md) (история; актуальный контракт — этот файл)
- [handbook/50-STAFF-OPERATIONS-SCREENS.md](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/50-STAFF-OPERATIONS-SCREENS.md) (история; актуальный контракт — этот файл)
- [handbook/53-TRUST-PUBLIC-HISTORY-AND-CONTENT-MODERATION.md](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/53-TRUST-PUBLIC-HISTORY-AND-CONTENT-MODERATION.md) (история; актуальный контракт — этот файл)
- [handbook/56-SUPPORT-SLA-AND-DISPUTE-TIMING.md](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/56-SUPPORT-SLA-AND-DISPUTE-TIMING.md) (история; актуальный контракт — этот файл) — staff/support timing
- [handbook/27-MESSAGING-GROUPS-AND-SOCIAL-SYSTEMS.md](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/27-MESSAGING-GROUPS-AND-SOCIAL-SYSTEMS.md) (история; актуальный контракт — этот файл) — только abuse/moderation boundaries

Сверка фактов runtime: [CURRENT-STATE.md](CURRENT-STATE.md), [FLOWS.md](FLOWS.md), [PROBLEMS.md](PROBLEMS.md), [OPERATIONS.md](OPERATIONS.md).
