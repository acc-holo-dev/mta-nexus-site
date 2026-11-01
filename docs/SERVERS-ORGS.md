# Серверы и организации — предметный контракт

**Статус DOC-05:** смысловой перенос глав 24, 30, 31, 48 и 49 в один предметный контракт. База сверки: `385e577e7443cf7d7b817419ce5c3b8afe87b690`. Handbook-источники не удалены (DOC-04 отдельно). Этот файл не активирует платежи, co-owner transfer, page builder и полный messaging-продукт.

Метки состояния:

| Метка | Значение |
|---|---|
| **current runtime** | Подтверждено кодом/миграциями на базе сверки; не значит production deploy |
| **owner target** | Принятая цель владельца; внедрение может быть неполным |
| **proposal** | Направление без разрешения на сборку без отдельной команды |
| **live unknown** | Нужны свидетельства с целевой среды или ещё не установлена готовность |

Смежные контракты: коммерция организации — [COMMERCIAL-FUTURE.md](COMMERCIAL-FUTURE.md); права, trust, staff и privacy — [TRUST-STAFF.md](TRUST-STAFF.md); пользовательские пути Join/Connect и отзывы — [FLOWS.md](FLOWS.md); каталог, карточка, метрики и empty/unknown — [UX-CONTRACT.md](UX-CONTRACT.md).

---

## 1. Два слоя: raw directory и managed profile

**Owner target.** Публичный сервер из MTA master list существует в NEXUS **независимо** от регистрации владельца. Discovery не ждёт claim.

**Различие слоёв (инвариант):**

1. **Raw MTA directory entry** — наблюдённая запись каталога: адрес, aggregate online/slots, observed online/offline/unknown. Это фактическая основа directory.
2. **NEXUS managed server profile** — claimed/управляемая страница после proof of control и модерации ownership: оформление, команда, новости, набор, события, связанные ресурсы. Editorial content **никогда** не подменяет live observation truth.

Жизненный цикл (**owner target**):

```text
Observed in MTA master list
  -> Public unclaimed entry
  -> Claim challenge
  -> Proof of control
  -> Ownership verification/moderation
  -> Claimed/managed server
  -> Optional Verified Server trust status
  -> Ongoing observations, content, team, analytics, promotion
```

Server-control proof и platform verification (**Verified Server**) — разные понятия: control доказывает управление endpoint/server; Verified может учитывать дополнительные evidence/trust criteria. Trust/verification **не покупаются**.

---

## 2. Claim, ownership и transfer

### 2.1 Метод claim

**Owner target / DECISION.** Основной proof — текущий **MTA server challenge/control proof**. DNS/website/file alternatives не добавлять «ради количества»; альтернатива — только при доказанной проблеме coverage/usability.

### 2.2 Co-owners

**Owner target / DECISION.** Claimed server может иметь нескольких co-owners. Модель отделяет:

- legal/product ownership relation;
- public titles;
- operational permissions;
- organization membership.

Ownership membership — relation со статусами и audit (поля концептуально: `server_id`, principal user/org, ownership role, `accepted_at`, `added_by`, `status`, permissions overlay), **не** массив usernames и **не** текстовый badge.

**Current runtime.** Listing и editing опираются на существующую модель ownership. Co-owner membership и ownership transfer из target выше — **будущая работа** (ещё не runtime).

### 2.3 Ownership transfer

**Owner target.** Explicit audited transfer user ↔ user/org:

```text
Current owner initiates
  -> target accepts
  -> re-auth / step-up checks
  -> policy validation
  -> transactional ownership change
  -> audit + notifications
```

Нельзя переносить ownership простым PATCH `ownerId`. Для risky transfer может потребоваться дополнительный control challenge. Подробности capability/re-auth — [TRUST-STAFF.md](TRUST-STAFF.md).

### 2.4 Organization proof lifecycle

**Current runtime.** Claim сервера организации использует **текущие** организационные права при выдаче challenge, потреблении proof и moderator approval. Проверки под transaction locks, включая delegated `manage_servers` и роль platform administrator. Отозванный grant не завершает следующий claim write.

Approval **сохраняет organization ownership** и очищает legacy personal owner; **никогда** не назначает менеджера организации personal server owner.

Каждый новый challenge записывает текущую organization (или явный personal scope). Смена/удаление organization инвалидирует старый proof независимо от address revision. Migration 0038 не записала older scope snapshots — старые pending требуют reject и новый proof; scope не выводится из текущей строки server и verified badges не снимаются молча.

Authorized management показывает pending/approved/rejected, времена submission/review и признак устаревания proof (адрес/org). Notes, tokens и internal proof data не отдаются. Pending скрывает новые challenge controls у всей команды; после rejection текущий manager может повторить. Модерация проверяет права перед approval и может отклонить stale request, даже если исходный requester потерял доступ. На **публичной** странице organization server нет personal ownership claim controls.

Proof и decision events попадают в private server activity (публичная identity ревьюера — когда доступна). Authoritative changes, audit и decision inbox коммитятся вместе. Unit coverage есть; **live unknown / pending:** real PostgreSQL, migration, browser и production-build acceptance.

---

## 3. Workspace managed servers (current runtime)

**Current runtime — `/workspace/servers`.** Authenticated listings личных и organization-managed серверов: bounded pages, RU/EN search, фильтры visibility, listing-status и ownership-verification. Organization owners и members с owner/admin или `manage_servers` видят серверы организации. Создатель в `owner_id` на organization server **всё равно** нуждается в organization grant.

Overview: четыре недавно обновлённых карточки и точный total; live metrics относятся к **показанным** карточкам; полный список — по страницам. Private cards ведут в authorized management. Listing maintenance и observed network availability показываются **раздельно**; недоступные observations остаются **unknown**. Page reads не выдают claims и не меняют ownership. Management routes **перепроверяют** доступ при каждом edit.

**Current runtime — `/workspace/servers/:id/activity`.** Приватная RU/EN история server-target audit: registration, listing updates, issued challenges, submitted proofs, moderation decisions. Запись: timestamp, публичная author identity при наличии, allowlist имён изменённых listing fields (описание saved edit request, **не** before/after diff). Raw details, previous/current values, IP/user-agent, credentials и challenge tokens **не** выбираются и не рендерятся.

Доступ: текущее personal ownership **или** organization ownership/owner/admin/`manage_servers` в read-only repeatable-read snapshot вместе с activity. Platform administrators — management override; ordinary moderators нужен server grant. Anonymous — нельзя; missing/revoked access → тот же not-found. Публичного history route нет.

Пагинация: 20 записей, ссылка на earlier activity; cursor — server-scoped audit anchor; сравнения timestamp внутри PostgreSQL (микросекунды и equal-timestamp ID order). Missing/deleted anchor → empty page + latest-activity link. Только записанные server-target actions; новые moderation decisions зеркалятся в timeline атомарно. Older verification-target events, ownership transfers и historical before/after **не** реконструируются.

**Owner target (history visibility / OWNER DECISION).** История page edits и ownership changes видна **только owners/staff**, не публичный changelog по умолчанию. Публичные announcements — отдельно и осознанно.

---

## 4. Join, Connect и privacy игроков

### 4.1 Join Server

**Owner target / DECISION.** На public server page — сильный `Join Server`: safe deep-link где поддерживается; copy endpoint fallback; visible connection info по privacy/public policy.

**Инвариант:** analytics может считать join-click/conversion, но **обязана** отличать `clicked join` / Connect/Copy intent от факта успешного входа игрока, если последний не доказан. Intent ≠ proven participation. Пути и copy — [FLOWS.md](FLOWS.md) (FLOW-16: «Открыть в MTA», copy/manual fallback); карточка каталога — [UX-CONTRACT.md](UX-CONTRACT.md).

### 4.2 Player identity

**Owner target / DECISION.** По умолчанию **не** публиковать live player identity/names. Directory и analytics — aggregate online/slots и минимально необходимые данные. Расширение telemetry — отдельное privacy/product решение ([TRUST-STAFF.md](TRUST-STAFF.md)).

### 4.3 Join analytics

**Owner target.** Owner analytics может учитывать clicks, approximate unique users/sessions, source/referrer/campaign, first-party technical telemetry (в т.ч. не как отдельный UI signal посетителю). Hidden telemetry ≠ undisclosed surveillance: сбор описан в Privacy/Cookie/analytics policy, минимизирован, с retention и consent/legal где применимо. Third-party/cross-site identifiers **не** default только потому, что сигнал невидим в UI.

---

## 5. Observed truth vs owner communication

**Owner target.** Claimed servers публикуют structured operational posts: maintenance, incident, scheduled restart, event, resolved/update. У каждого — timestamps, author/team context, visible status.

**Инвариант.** Owner statement («maintenance») **не** переопределяет фактический observed online/offline/unknown. Editorial status нельзя выдавать за network observation. Неизвестное число игроков не становится нулём или offline ([UX-CONTRACT.md](UX-CONTRACT.md)).

**Owner-confirmed screens (48):** Incidents, Maintenance и Events — **отдельные** sections/workflows, не один combined timeline editor; на публичной хронологии могут рендериться вместе, семантика создания/управления остаётся различной.

---

## 6. Team, customization, recruitment, trust

### 6.1 Server team

**Owner target.** Публичные роли вроде Owner, Administrator, Developer, Moderator, Support (экраны 48 также: Content). Внутренние permissions granular и **не обязаны** совпадать 1:1 с titles. Server team использует **тот же capability engine**, что Organizations — не упрощённую отдельную модель ([TRUST-STAFF.md](TRUST-STAFF.md)).

### 6.2 Safe customization / page builder

**Owner target.** Широкая свобода в безопасных primitives: block reordering, banner/colors, media, custom text/sections, predefined widgets; visual block editor с desktop/mobile preview. **Arbitrary HTML/CSS/JS не допускается** (XSS, impersonation, a11y, compatibility).

Target modules claimed page: logo/banner/media; description/rules; social/website; current observed status; historical analytics; updates/news; team roster; recruitment/vacancies; factions/clans; applications; events; related resources; community space; reviews/trust. Public modules (48): Overview, live status, history/statistics, updates/news, events, recruitment, team, media, reviews/trust, community space, Join CTA.

### 6.3 Recruitment

**Owner target.** Forms из approved field types + custom questions. Ответы private by default, retention/delete policy, role-scoped access. Pipeline приложений: `New / Reviewing / Interview / Accepted / Rejected`.

### 6.4 Trust / reviews

**Owner-delegated decision.** Не использовать одну star-rating как единственный рейтинг сервера. Target reputation combines: verified interaction reviews; current/recent activity; observed availability/uptime-like signals; follows/community engagement; verified ownership; moderation/enforcement history; freshness managed page/content. UI может показывать reviews отдельно; ranking объяснять несколькими сигналами. Детали trust — [TRUST-STAFF.md](TRUST-STAFF.md); denials отзывов — [FLOWS.md](FLOWS.md) FLOW-18 (server review: active/public + follow, исключает владельца; основания ≠ доказательство игровой сессии).

### 6.5 Server Pro и promotion

**Owner target / proposal к активации.** Server Pro может давать deeper history/analytics, page customization, more media, API/webhooks, alerts, team tools, automation, promotion allowance/discount/inventory. Promotion зависит от subscription/tariff. Trust/verification never purchasable. Активация платежей и тарифы — [COMMERCIAL-FUTURE.md](COMMERCIAL-FUTURE.md); не часть бесплатной beta по умолчанию.

### 6.6 Factions/clans, community space

**Proposal / не runtime.** Модули factions/clans и полноценный community space на странице сервера — owner target surfaces; наличие Organization/support **не** объявляет groups/clans/events готовым продуктом ([PRODUCT.md](PRODUCT.md)).

---

## 7. Owner dashboard screens (owner-confirmed target)

**Owner target (48).** Primary live block dashboard: current status; online count; 24h/7d graph; latest observation timestamp; Join clicks; follows; reviews/trust summary; active incidents; quick actions. MTA live state — observation-backed; **не** фабриковать из editorial data.

---

## 8. Organization как универсальная сущность

**Owner target.** Organization подходит для development studio, server team, commercial team/business, community project, mixed team (resources + servers + content). Пользователь может состоять в нескольких organizations.

Governance needs: invites; member roles; granular permissions; ownership transfer; billing owner; resource/server ownership; audit log; public profile; privacy settings; organization subscription/billing.

### 8.1 Workspace context switching

**Owner target (49).** Единый `/workspace` с active actor context. Переключение на Organization меняет вместе: Resources, Servers, Billing, Payouts, Support, Deals, Members/permissions, Audit. Personal context остаётся отдельно доступным.

### 8.2 Organization Overview

**Owner target.** Member count / pending invites; owned servers; owned resources; active subscriptions; revenue / payout status; open support/deals; recent audit; high-risk/action-required notices.

### 8.3 Members, templates, invites

**Owner target.** Templates: `Owner / Admin / Developer / Support / Finance / Content` — shortcuts над granular capability engine; authorization проверяет **capabilities**, не только имя шаблона. Org и server team делят одни capability-концепты ([TRUST-STAFF.md](TRUST-STAFF.md)).

Critical actions → re-authentication + audit: ownership transfer; payout destination / billing identity changes; выдача Finance capability; permanent deletion/archive; иные high-risk по security policy.

Invites: персональные **и** invitation links (expiry, max uses, target role/template, revoke, audit; optional domain/verification restrictions — future). Персональные invites сохраняются.

### 8.4 Public organization storefront

**Owner target.** Public surface: organization identity; выбранные для публичности members; resources; servers; articles/content; reviews/reputation; verified external links.

---

## 9. Organization commerce (ссылка, не активация)

**Owner target / DECISION.** Organization — коммерческий principal, не только team wrapper: owns resources; seller identity; provider-supported payouts; buys subscriptions; owns server pages; opens/participates in deals; owns support responsibilities.

Billing profile **принадлежит Organization** и отделён от personal profile участника. Target: legal/display entity data where required; provider merchant/subaccount; payout configuration; billing contacts; tax/invoice where applicable; billing permissions; full audit. Secrets/provider tokens **не** показываются ordinary admins.

Finance permissions минимум: `view_finance`, `manage_billing`, `manage_payouts`, `view_orders`, `handle_refunds/disputes` where policy permits, `buy_subscriptions`, `manage_seller_products`. Step-up для high-risk finance changes. Finance — **отдельная** visual и permission-wise секция (49): balance; pending/available/paid; payouts; provider/KYC; orders/refunds/disputes; invoices/receipts; subscription billing. Developers/support **не** получают finance «по совместительству».

KYC/legal requirements определяет provider/jurisdiction **перед** activation. Полный коммерческий контур, DRM, планы и payouts — [COMMERCIAL-FUTURE.md](COMMERCIAL-FUTURE.md). Этот контракт **не** включает платежи в бесплатную beta.

---

## 10. Organization messaging policy ≠ продукт Groups/DM

**Owner target — policy only.** Для незнакомых пользователей default — Message Request. Direct contextual communication разрешена для: buyer/seller support case; Deal participants; Organization members; server team members; approved private group participants; staff case communication.

Block останавливает private/social interaction, но **не** скрывает обязательный financial/dispute/audit notice.

Invite-only groups/spaces поддерживаются как направление; group privacy **не** отменяет platform abuse moderation/reporting.

**Инвариант DOC-05.** Эта messaging policy **не** равна готовому продукту groups/DM. Полноценные личные сообщения, groups и native social spaces остаются future/proposal, пока нет отдельной приёмки ([PRODUCT.md](PRODUCT.md), community-контракт). Voice/video calls **не** входят в scope NEXUS; предпочтительны внешние Discord/Telegram links/integrations.

---

## 11. Профили пользователя (связанный контур)

**Owner target.** Отдельные настройки публичности: activity; purchases; resources; servers; organizations; achievements; portfolio; social links. Security-sensitive / private commerce data **не** становится public из‑за «открытого» профиля.

Customization target: avatar; banner; bio; links; portfolio; showcase resources/servers; badges; achievements; activity. Paid plans могут давать visual options, **не** trust status.

**Identity model.** Public profiles по умолчанию для deliberately public fields; purchases, email, payment, session/device, IP и private membership остаются private. Immutable User ID у каждого аккаунта. Paid subscription может дать vanity username/custom public slug — vanity **не** заменяет immutable IDs в audit/payment/ownership и не имитирует staff/trust labels. Смена уже выбранного vanity — отдельная платная операция по approved policy. Verified external links (GitHub, Discord, domain/site) доказывают control аккаунта/домена, **не** quality endorsement. Детали identity/trust — [TRUST-STAFF.md](TRUST-STAFF.md) и community-контракт.

---

## 12. Сводка границ

| Тема | Состояние |
|---|---|
| Raw MTA directory vs managed profile | **Owner target** + инвариант; raw существует без claim |
| Workspace listings, filters, activity, org proof lifecycle | **Current runtime** (unit covered; PG/browser/prod acceptance — **live unknown**) |
| Co-owners relation + audited transfer | **Owner target**; не current runtime |
| Join/Connect/Copy intent ≠ participation | **Owner target** / runtime copy path в FLOWS; не доказательство игры |
| Player names по умолчанию скрыты | **Owner target** |
| Page builder, recruitment pipeline, Server Pro UI | **Owner target**; arbitrary HTML запрещён |
| Org billing/seller/payouts | **Owner target**; активация — COMMERCIAL-FUTURE; не free beta |
| Messaging policy (request / contextual) | **Owner target** policy |
| Full groups/DM/calls product | **Proposal / out of native calls scope** |
| Factions/clans / calendar events as product | **Proposal** |
| Production behavior org claim / join conversion | **Live unknown** без свидетельств среды |

---

## Источники

Смысл перенесён из:

- [docs/handbook/24-SERVERS-ORGANIZATIONS-AND-PROFILES.md](SERVERS-ORGS.md)
- [docs/handbook/30-SERVER-OWNERSHIP-STATUS-AND-JOIN.md](SERVERS-ORGS.md)
- [docs/handbook/31-ORGANIZATION-COMMERCE-AND-MESSAGING-POLICY.md](SERVERS-ORGS.md)
- [docs/handbook/48-SERVER-OWNER-SCREENS.md](SERVERS-ORGS.md)
- [docs/handbook/49-ORGANIZATION-SCREENS.md](SERVERS-ORGS.md)

Перекрёстные контракты: [COMMERCIAL-FUTURE.md](COMMERCIAL-FUTURE.md), [TRUST-STAFF.md](TRUST-STAFF.md), [FLOWS.md](FLOWS.md), [UX-CONTRACT.md](UX-CONTRACT.md), [PRODUCT.md](PRODUCT.md).
