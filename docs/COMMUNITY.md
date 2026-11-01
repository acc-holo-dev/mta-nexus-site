# Community, identity и social — предметный контракт

**Статус:** интегрированный черновик DOC-05 (предметный контракт). База сверки: `385e577e7443cf7d7b817419ce5c3b8afe87b690`. Handbook-главы остаются действующими источниками до DOC-04. Реестр ID — в [DECISIONS.md](DECISIONS.md) / [13-DECISION-REGISTER.md](handbook/13-DECISION-REGISTER.md).

**Метки смысла.** `текущий runtime` — подтверждено кодом на базе сверки. `owner target` — принятое целевое правило владельца. `proposal` — направление без обязательства внедрения. `live unknown` — live/production факт не установлен этим контрактом.

Смежные контракты: сценарии follow/review/уведомлений — [FLOWS.md](FLOWS.md); полезное удержание и метрики — [RETENTION-PLAN.md](RETENTION-PLAN.md); модерация, sanctions, staff casework — [TRUST-STAFF.md](TRUST-STAFF.md).

---

## 1. Цель и границы

- **owner target:** community — самостоятельный pillar с реальной MTA-ценностью и возвращаемостью, не пустой engagement (CT-002, CT-003).
- **owner target:** entity-linked graph — topic/article/update/event связываются с User, Organization, Server, Resource/Product, Version/Release, Event; community не изолированный форум.
- **исключение / hard rule:** наличие/Organization, gallery, LibraryCollection и **support case не делают готовыми** независимые groups/clans, user DM, calendar events или social messaging. Эти сущности — отдельные social capabilities с собственной политикой прав.
- **proposal / future scope до первой коммерческой версии (не «готово»):** DM; независимые groups/clans; managed server/org community spaces в полной IA; Markdown+code+images/files+safe embeds; polls; reactions; mentions; bookmarks; events/contests для eligible actors; achievements/levels/seasonal awards. Trust/verification badges и platform enforcement labels **не смешиваются** с achievements.
- **owner target daily surface:** персонализированная смесь `news/content + servers + marketplace + community + notifications`; personalization можно полностью отключить → neutral recent/trending/filters (CD-010, CD-011). Детали Home/Discover — UX/PRODUCT, не этот файл.
- **метрики:** weekly active community members, returning users, meaningful sessions, answered threads, discovery conversion, creator retention, successful updates/purchases — предпочтительнее raw page views. Операционализация и анти-накрутка — [RETENTION-PLAN.md](RETENTION-PLAN.md).

---

## 2. Identity и публичный профиль

### 2.1 Якорь личности

- **owner target:** immutable internal/public-stable **User ID** — главный identity anchor; не зависит от подписки, vanity и оформления (ID-010).
- **owner target:** обычный пользователь может публично существовать под ID; **vanity username** — платная customization/discovery capability, не отдельная identity (ID-010).
- **текущий runtime:** единственный уникальный `users.username` при регистрации; маршруты `/users/[username]`; отдельного entitlement/vanity lifecycle в схеме нет.
- **owner target vanity rules:** User ID immutable; username не заменяет ID в audit/security/payment; unique + reserved/impersonation checks; не даёт verification; не копирует staff/verified visual identity; **смена выбранного vanity — отдельная платная операция** (ID-002); после окончания entitlement — **7-дневный grace/reservation**, затем slug освобождается (ID-001, ID-003); потеря entitlement не разрушает identity/audit; staff search всегда по immutable ID + historical presentation как audit metadata.
- **live unknown:** применяются ли vanity/grace на каком-либо live окружении.

### 2.2 Auth и внешние связи

- **owner target:** основной вход — **email/password**; social networks **не** login providers на данном этапе (ACC-003).
- **owner target:** Discord/GitHub/Google/website и др. — verified links / identity evidence; OAuth/challenge допустимы **только** для подтверждения владения внешним аккаунтом, не как альтернативный login; verified external ≠ platform verification / Seller / Staff (ID-011).
- **owner target методы proof:** OAuth где доступно; DNS TXT / domain challenge; signed/tokenized file/page; provider-specific bot/interaction. **Не** просить secrets/API tokens в профиле.
- **текущий runtime:** поля вроде `github_url` / `discord_tag` / website без продукта verified-links; verification_requests с optional `proof_url` — не замена verified external links.
- **owner target email verification:** почти все state-changing public действия требуют подтверждённого email (comments/forum/content, follows, free claim, trial, purchase, publishing, server claim, DMs/support, org/server invitations и ownership-sensitive). Гость и unverified могут читать разрешённые public surfaces. Исключения recovery/support/security — явные, без deadlock (ACC-001, ACC-002).

### 2.3 Публичность и customization

- **owner target:** профиль нового пользователя **публичный по умолчанию** только для специально public-полей (ID-009): public ID / vanity; avatar/banner; bio; badges/verification; public orgs/resources/servers; selected achievements; public posts/activity where policy allows; verified external links.
- **исключение:** никогда автоматически не публиковать email, payment history, private purchases, IP/device/session, moderation evidence, private org membership.
- **текущий runtime:** публичный профиль + privacy toggles (activity / professional contacts) — не полный private account; см. FLOW-15 в [FLOWS.md](FLOWS.md).
- **owner target customization:** avatar, banner, bio, social/external links, portfolio, showcase resources/servers, achievements, activity, Pro themes. **Нельзя** имитировать trust badges, staff UI, warning banners, SCAM/verification labels (UX-003).
- **owner target monetization boundary:** можно — vanity, themes, showcase blocks, media/customization, professional presentation. **Нельзя** как cosmetic purchase — Verified Seller/Developer/Server/Organization, Clean Build, staff status, SCAM removal, review authenticity.
- **owner target anti-impersonation UI:** всегда различимы immutable User ID, vanity, verified external account, platform verification badge, staff status, organization identity.

---

## 3. Поверхности community

### 3.1 Target surfaces

**owner target** набор: global forum; server discussions; resource discussions/support; articles/guides; ecosystem news; creator devlogs; server updates/changelogs; activity feed; follows/notifications; events/contests; **DM к первой коммерческой версии** (CT-005…CT-007, CD-001).

### 3.2 IA `/community`

**owner target** (COM-003, PROF/community screens): секции `Feed / Forum / Articles / Events / Groups`.

| Секция | Правило |
|---|---|
| Feed | Отделен от Home; может infinite scroll + cursor; permission/moderation aware; смешивает community activity, **не** marketplace/server search (FEED-002) |
| Forum | `Categories → Boards → Topics → Posts`; servers/orgs могут вести managed spaces в том же permission/moderation framework |
| Articles | Long-form guides/editorial/community; часть классов — premoderation по risk/promotion |
| Events | Только eligible actors (verified entities, servers, orgs, staff — configurable); не право «купить рекламой» (CD-004) |
| Groups | Public и private/invite-only; **отличны** от Organization и server ownership (CD-002) |

- **текущий runtime:** `/community` (+ `/community/new`) на content types `post`/`question`; обсуждения/комментарии у публикаций; editorial `/articles`; workspace content/feed/discussions; follows; in-app notifications + Web Push; reactions (ограниченный набор). Отдельного `/forum`, hub Events/Groups, calendar social events **нет**.
- **proposal:** полная Forum IA и Community Feed как в таблице выше.
- **hard rule:** наличие/org team pages ≠ groups/clans; наличие ≠ DM.

### 3.3 Managed spaces и режимы модерации

- **owner target:** verified/authorized server owners и organizations могут создавать community spaces/subforums, назначать local moderators в granted capabilities и структурировать обсуждения; **NEXUS сохраняет platform-wide safety/moderation override и audit** (CT-009).
- **owner target modes:** `pre_moderated`, `post_moderated`, `trusted_auto_publish`, `staff_only`, `organization_managed` (+ platform override).
- **owner target кандидаты обязательной pre-moderation на launch policy:** advertising/promotional в controlled/editorial inventory; homepage/editorial spotlight; first publications new/untrusted; long-form articles/guides; server news и creator devlogs для broader discovery (CT-010, MOD-008, MOD-009).
- **owner target progressive trust:** first forum topic new account — premoderated (MOD-007); healthy history → immediate publish + post-moderation; low/new-trust articles/guides — premoderated; established healthy — post-moderation/reporting; claimed-server news/devlogs — immediate при отсутствии active risk flags; events/contests — eligible + selective moderation; **вся** paid advertising/featured — review до показа; reputation может поднять quotas, но major surfaces сохраняют limits (MOD-006).
- **текущий runtime:** publications/comments + reports/moderation tooling существуют; полная matrix режимов и managed subforums как product — **не** объявлена готовой.
- **live unknown:** фактическая доля pre-moderation и override в production.

### 3.4 Feed quality

- **owner target:** rank meaningful activity по follows, ownership, discussions, verified updates, guides, language, mute/block, moderation quality; sponsored — только явно labeled inventory (CD-008).
- **proposal:** глубина personalization OPEN (CT-006).

---

## 4. Reputation, verification и reviews

Подробный staff/public disclosure — [TRUST-STAFF.md](TRUST-STAFF.md). Здесь community-facing контракт.

### 4.1 Три понятия

**owner target:** (1) **Verification** — evidence-backed confirmation конкретного claim/status; (2) **Reputation** — много независимых behavioral/history signals; (3) **Reviews** — feedback с provable interaction/purchase/claim eligibility. **Ничего из трёх нельзя купить как truth** (CT-008, REP-005).

### 4.2 Reputation

- **owner target:** multiple signals, не один opaque score как единственная правда (REP-001). Кандидаты: account age; verified identity/ownership; completed paid orders; successful resource history; fulfilled services/projects when domain exists; ratings/review distribution; verified server interaction; dispute/refund outcomes with context; moderation violations/sanctions; response/support behavior; portfolio/public project history; GitHub/other linked proof; org/server ownership track record.
- **owner target UI:** composite summary может появиться позже; source signals остаются inspectable. Seller response time / support satisfaction **не** обязательный публичный reputation signal (можно internal analytics) (REP-006).
- **текущий runtime:** флаги `isVerified` / `verified_developer` / org/server verified; `developer_profiles.reputation_score`; публичные trust surfaces у пользователя; **нет** полного multi-signal reputation product как единственного публичного score (copy уже предупреждает об этом).

### 4.3 Verification types и evidence

- **owner target types (где evidence):** User/Identity, Developer, Seller, Organization, Server, specialized program statuses.
- **owner target Developer/Seller evidence (принцип):** meaningful account/project history; successful sales/orders/projects where applicable; no unresolved severe violations; portfolio and/or public source; manual review when necessary. Thresholds configurable/type-specific; payment/subscription **не** заменяет evidence.
- **owner target badges (каждый с documented meaning):** Verified User/Developer/Seller/Server/Organization; Clean Build; DRM Protected; Verified Purchase Review; Verified Server Interaction; Official/Staff. Decorative Pro themes не имитируют и не перебивают trust badges.
- **owner target revocation/expiration:** некоторые типы expire / revalidation; revoked/expired — auditable state; historical fact и current status не переписываются молча. Rejected/revoked — appeal path с additional evidence, сохранением original decision, independent review where practical (ADM-005).
- **текущий runtime:** verification_requests + staff workflow; не полный набор badge semantics из списка выше.
- **live unknown:** операционная нагрузка ручных reviews на live.

### 4.4 Reviews

- **owner target eligibility:** paid resource — только verified purchaser/entitled buyer (REP-002); free — recorded claim/download/eligible interaction (REP-003); server reviews later могут требовать verified interaction, не drive-by.
- **owner target UI:** label evidence class (`Verified Purchase`, `Claimed Resource`, …), без implication endorsement качества NEXUS.
- **owner target update:** reviewer может обновить review, в т.ч. после новой версии; сохранить timestamps и material edit history/version context — seller не выдаёт edited review за «всегда про newest build» (REP-004).
- **owner target moderation reviews:** remove/limit за spam, conflict of interest, abuse, extortion, impersonation, non-product content, policy violations. **Negative but legitimate** не снимается только из-за недовольства seller.
- **текущий runtime:** resource reviews (доступ + exclude author/managers); server reviews (active/public + follow, exclude owner); plan reviews; denials/flow — [FLOWS.md](FLOWS.md) FLOW-18. Evidence labels Verified Purchase как полный product — частичны/зависят от commerce path.
- **исключение:** follow/access **не** доказывают установку или игровую сессию.

---

## 5. Messaging, groups и social systems

### 5.1 Direct messages

- **owner target к первой коммерческой версии:** 1:1; unread; block/mute; report; attachments under strict type/size; anti-spam/rate limits; privacy «who may message»; staff access только через defined moderation/legal process, не casual browsing (CD-001).
- **owner target attachments:** images/text/logs/safe archives после malware scan; **executable distribution через DM запрещён** как ordinary flow; marketplace/resource delivery — свой trusted pipeline (MSG-001).
- **owner target default DM policy (exact default delegated; target):** transaction/deal/support participants пишут в соответствующем context без friend gate; members одной Organization/server team/private group — по membership policy; незнакомый → **Message Request**, не сразу основной inbox; recipient может разрешить broader DMs; low-trust/new — tighter quotas.
- **owner target block:** полноценная privacy/safety primitive: DMs/message requests; mentions; invites; targeted replies/interactions where feasible; исключение из персональных рекомендаций. **Исключение:** public content moderation и обязательные transaction/legal notices не исчезают так, чтобы ломать dispute/audit.
- **owner target:** NEXUS **не** строит собственные voice/video calls; sync — внешние integrations/links (Discord/Telegram); продукт фокусируется на async messaging, support, deals, community.
- **текущий runtime:** user DM / conversations / message requests **отсутствуют**. Есть **support** cases/messages (приватный async канал сделки/помощи) — это **не** social DM.
- **hard rule:** наличие не объявляет DM готовым.
- **live unknown:** потребуется ли отдельный retention/privacy policy слой для DM до commercial launch.

### 5.2 Groups / clans

- **owner target:** social entity отдельно от Organization и Server — игроки, thematic communities, кланы, временные команды, interest groups (CD-002).
- **owner target:** invite-only/private groups и community spaces с role/permission model + platform moderation override.
- **исключение:** group **не** получает автоматически commercial ownership/billing capabilities Organization.
- **текущий runtime:** organizations + membership; **нет** clan/group entity.
- **hard rule:** org/team ≠ groups/clans readiness.

### 5.3 Community editor

- **owner target:** Markdown; code blocks; images/files; approved embeds; polls; reactions; mentions; bookmarks. Все untrusted HTML/embeds/files — sanitize/validation (CD-003).
- **текущий runtime:** публикации/комментарии + ограниченный reactions set; полный editor toolkit (polls/mentions/bookmarks/safe embeds как единый контракт) — не завершён.

### 5.4 Events / contests

- **owner target:** community/server/resource/dev competitions и official NEXUS events с archive/results и anti-abuse voting policy where applicable; создание только eligible actors (verified server owner/team, org with permission, approved creator, staff); exact eligibility configurable; не покупается одной рекламой (CD-004).
- **текущий runtime:** social events/calendar **нет** (операционные license/audit events в схеме ≠ community events).
- **hard rule:** наличие/org announcements ≠ events system ready.
- **proposal в retention:** ручные игровые/тестовые вечера как пилоты — [RETENTION-PLAN.md](RETENTION-PLAN.md), не замена product calendar.

### 5.5 Achievements / levels

- **owner target допустимы:** participation achievements; creator milestones; server/community milestones; seasonal badges; community awards (CD-005).
- **исключение:** не заменяют verification/trust; не продаются как доказательство репутации; achievement ≠ identity/commerce safety.

### 5.6 Progressive anti-abuse

- **owner target:** new/low-trust — progressive limits на DMs, mentions, posts/comments, reviews, resource submissions, external links/attachments (ABUSE-001). Снятие через account age, verified email/security, нормальную историю и policy-defined trust signals — **не только оплату** подписки.
- **текущий runtime:** rate limits на support и отдельные content paths; единая progressive matrix на все abuse-sensitive actions — не как полный social product.

---

## 6. Уведомления (community scope)

- **owner target channels:** in-app, email, Web Push, Telegram, Discord — с preferences, rate limits, security/privacy (NT-001). Пользователь управляет channels/categories, кроме минимально необходимых security/transactional (NOTIF-002).
- **owner target текущего этапа delivery:** in-app, email, Web Push/PWA. **Telegram/Discord notification bots отложены** — не обязательный release dependency на bot tokens/guild membership (NOTIF-001).
- **текущий runtime:** in-app inbox с categories; notification preferences; Web Push; durable workers для ряда событий. Follow vs release watch vs discussion follow — разные действия ([FLOWS.md](FLOWS.md)).
- **proposal:** mute/snooze объекта без скрытого выключения всей категории (FLOW-05).
- **live unknown:** реальная доставка push/email на production host.

---

## 7. Экраны профиля и community (target IA)

**owner target** public profile tabs: `Overview / Activity / Resources / Servers / Organizations / Reviews / Achievements / Trust` (PROF-001…003, TRUST-001).

| Tab | Смысл |
|---|---|
| Overview | avatar/banner/bio; immutable identity / public id; vanity при entitlement; verified links; badges/selected achievements; selected resources/servers/orgs; public social links |
| Activity | **full public activity feed**, constrained by privacy и visibility underlying entity; **никогда** private purchases, private group activity, support, disputes, internal staff actions (PROF-002) |
| Resources / Servers / Organizations | только public associations; membership visibility — privacy user + org/server rules |
| Reviews | eligible public reviews пользователя; moderation + entity visibility |
| Achievements | community/seasonal/awards; не purchasable trust |
| Trust/Reputation | отдельная публичная вкладка: verified evidence, exact successful sales/deals counts, verified reviews/badges, finalized public moderation history; **без** private amounts, internal notes, sensitive evidence (TRUST-001…003) |

- **owner target messaging entry:** Profiles могут давать `Message` по message-request/block/privacy; pre-sale resource questions могут входить в unified seller support (не путать с social DM readiness).
- **текущий runtime:** `/users/[username]` (+ activity, trust); ресурсы/серверы автора; follow; **не** полный tab set Overview…Achievements как единая IA; Message CTA social DM отсутствует.
- **mobile nav owner target (NAV/UX):** Community в top-level; Messages/Notifications — header/More; не означает наличие DM runtime.

---

## 8. Что не обещать

- Готовность groups/DM/events/clans по факту support/org.
- Покупку verification, review authenticity, SCAM removal или staff status.
- Voice/video звонки NEXUS.
- Telegram/Discord bots как release gate текущего этапа.
- Opaque единый reputation score как единственную правду.
- Измеренный retention uplift от community features — только через [RETENTION-PLAN.md](RETENTION-PLAN.md) пилоты.
- **live unknown** production routing, capacity и фактическая модерационная нагрузка — вне этого черновика.

---

## Неоднозначности (открытые стыки)

1. **Username сейчас vs vanity target:** runtime username обязателен при регистрации; owner target допускает публичное существование под ID + optional paid vanity — миграционная семантика slug/ID не закрыта в коде.
2. **Default DM policy** — owner delegated exact default; зафиксирован target Message Request, но пороги quotas/matrix — configurable OPEN.
3. **«Forum» naming:** runtime community feed на `post`/`question` ≠ Categories/Boards IA; не объявлять Forum ready.
4. **Server review evidence:** target «verified interaction»; runtime — follow + public/active; расхождение намеренно помечать до отдельной verification.
5. **Reputation_score в developer_profiles** vs REP-001 multi-signal inspectable model — UI/product правило «не один opaque score» должно сохраняться при любом composite summary.
6. **Pre-sale Message vs Support vs future DM** — единый inbox seller support не равен social DM; граница UX ещё уточняется в FLOWS/commerce.
7. **Personalization depth** и exact eligible actors для events — CONFIRMED direction, детали OPEN.
8. **TRUST-STAFF.md** ещё может отсутствовать; community-facing trust здесь, staff enforcement — там после переноса.

---

## Источники

Handbook (сохраняются до DOC-04):

- [19-COMMUNITY-AND-RETENTION.md](COMMUNITY.md)
- [21-REPUTATION-VERIFICATION-AND-REVIEWS.md](COMMUNITY.md)
- [27-MESSAGING-GROUPS-AND-SOCIAL-SYSTEMS.md](COMMUNITY.md)
- [36-IDENTITY-PROFILES-AND-VERIFIED-LINKS.md](COMMUNITY.md)
- [45-USER-PROFILE-COMMUNITY-SCREENS.md](COMMUNITY.md)

Смежные интегрированные контракты:

- [RETENTION-PLAN.md](RETENTION-PLAN.md)
- [FLOWS.md](FLOWS.md)
- [TRUST-STAFF.md](TRUST-STAFF.md)
- [DECISIONS.md](DECISIONS.md) / [13-DECISION-REGISTER.md](handbook/13-DECISION-REGISTER.md)
