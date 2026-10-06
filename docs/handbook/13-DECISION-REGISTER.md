# MTA NEXUS — Decision Register

> Статус: v0.10, 2026-10-06 — owner interview rounds 1–9 incorporated.
> Этот файл нужен людям и AI-агентам: он отделяет решения от current implementation, legacy и ещё открытых деталей.

## Статусы

- `CONFIRMED` — подтверждено владельцем или текущим обязательным policy;
- `CURRENT` — факт текущей реализации/closed beta, который может отличаться от target;
- `PROVISIONAL` — рабочая позиция до уточнения;
- `OPEN` — решение не принято;
- `LEGACY` — старое решение MTA-MARKET-PLATFORM, не переносить автоматически;
- `REJECTED` — явно не использовать.

---

## A. Product

| ID | Статус | Решение | Комментарий |
|---|---|---|---|
| P-001 | CONFIRMED | Продукт называется MTA NEXUS | Current repo |
| P-002 | CONFIRMED | Позиционирование: «единая площадка для всего сообщества MTA» | Owner answer #1 |
| P-003 | CONFIRMED | RU и EN — first-class interfaces | Current + owner continuity |
| P-004 | CONFIRMED | Real data only | Не показывать fake metrics/functionality |
| P-005 | CONFIRMED | Privacy by default | Публичность должна быть осознанной |
| P-006 | CONFIRMED | Servers / Resources / Community / Content / Marketplace / Trust развиваются равноправно | Не server-first monopoly |
| P-007 | CONFIRMED | Главная аудитория — все, кто входит на сайт | Не только player/seller/server owner |
| P-008 | CONFIRMED | Community должен быть большим и удерживать через полезные сценарии | Forum/content/feed etc. |
| P-009 | OPEN | Финальный slogan/subtitle | Branding detail |
| P-010 | OPEN | Точная North Star metric | Retention/meaningful time likely core |

## B. Engineering

| ID | Статус | Решение | Комментарий |
|---|---|---|---|
| E-001 | CONFIRMED | `main` — maintained development line | Не возвращать permanent `dev` автоматически |
| E-002 | CURRENT | Modular monolith | Current architecture |
| E-003 | CURRENT | Next.js + React + PostgreSQL/Drizzle | Current stack |
| E-004 | CURRENT | Docker Compose — canonical full dev path | Host-only optional |
| E-005 | CONFIRMED | Не вводить distributed infra без measured need | Redis/queues/K8s not default |
| E-006 | CONFIRMED | Forward-only shared migrations | Code rollback != DB rollback |
| E-007 | CONFIRMED | Exact-SHA release evidence | Release candidate discipline |
| E-008 | CONFIRMED | Production deploy — human decision | Green CI alone not authorization |
| E-009 | OPEN | Final production hosting/provider | Нужно определить |
| E-010 | CONFIRMED | Production marketplace artifacts use private object storage + signed CDN delivery | Local filesystem remains dev/test fallback |
| E-011 | OPEN | Exact production observability vendor/delegation policy | Required capabilities are understood; owner has not approved who chooses vendors |
| E-012 | OPEN | Финальная repo docs policy для handbook | Current policy допускает только 3 long-form docs |

## C. Resource safety

| ID | Статус | Решение | Комментарий |
|---|---|---|---|
| S-001 | CURRENT | Public build только published + clean + scanner + scannedAt | Fail-closed invariant |
| S-002 | CURRENT | Download повторно проверяет artifact integrity | Defense in depth |
| S-003 | CURRENT | Immutable generated storage keys | User filename не path identity |
| S-004 | CURRENT | Upload bounded и scan-limit fail-closed | Incomplete scan != clean |
| S-005 | CURRENT | SHA-256 + size metadata | Integrity |
| S-006 | CONFIRMED | Subscription auto-publish не отключает mandatory safety/integrity/policy checks | Manual moderation queue may be bypassed |
| S-007 | OPEN | Platform artifact signing/provenance UI | Strong candidate |
| S-008 | OPEN | Resource Inspector depth | Strong candidate |

## D. Servers

| ID | Статус | Решение | Комментарий |
|---|---|---|---|
| SV-001 | CURRENT | Live state приходит из public MTA observation path | Не owner fake fields |
| SV-002 | CURRENT | External directory bounded + stale TTL | Reliability |
| SV-003 | CURRENT | Server-control proof и moderator ownership approval различаются | Different semantics |
| SV-004 | CURRENT | public/unlisted/private visibility | Current schema |
| SV-005 | CONFIRMED | Server pillar равноправен, а не единственный центр продукта | Owner answer #3 |
| SV-006 | CONFIRMED | Server Pro допустим со всем предложенным feature set | Analytics/customization/API/webhooks/media/team/automation/promotion |
| SV-007 | CONFIRMED | Directory показывает все публичные MTA master-list servers | Claim не обязателен для discovery |
| SV-008 | CONFIRMED | Historical analytics входят в Server Pro value | Exact free/pro retention OPEN |
| SV-009 | OPEN | Verified-interaction server reviews | Trust design |
| SV-010 | CONFIRMED | DRM module/runtime используется для продуктов, где seller включил DRM | Universal runtime; no per-server compile |

## E. Identity / Seller

| ID | Статус | Решение | Комментарий |
|---|---|---|---|
| I-001 | CONFIRMED | Один User может иметь несколько roles/capabilities | One identity |
| I-002 | CURRENT | Global roles user/developer/server_owner/moderator/admin | Current schema |
| I-003 | CURRENT | Organizations owner/admin/developer/member + permissions | Current schema |
| I-004 | CONFIRMED | Authorization проверяет current ownership/context | Historical author != permanent bypass |
| I-005 | CONFIRMED | Отдельная обязательная seller application не нужна | Moderation focuses on product |
| I-006 | CONFIRMED | Seller — capability/business state поверх общей identity | Не отдельный account |
| I-007 | CONFIRMED | Verified Seller/Developer — evidence-based trust status | Не продаётся и не нужен для base selling permission |
| I-008 | OPEN | Stable creator/server/org capability taxonomy | Further design |

## F. Commerce

| ID | Статус | Решение | Комментарий |
|---|---|---|---|
| C-001 | CURRENT | Closed beta paid checkout disabled | Current runtime |
| C-002 | CURRENT | Closed beta balance/payout/crypto disabled | Current runtime |
| C-003 | CONFIRMED | Paid marketplace входит в target | Owner answer #4 |
| C-004 | CONFIRMED | Platform marketplace commission = 10% | Owner answer #5 |
| C-005 | CONFIRMED | Purchase != Payment != License/Entitlement | Preserve strong domain boundary |
| C-006 | CONFIRMED | 10% считается от реально оплаченной суммы после скидки | PSP/tax/provider fees учитываются отдельно |
| C-007 | CONFIRMED | Multi-currency/multi-method payment direction | Launch coverage depends legal/provider availability |
| C-008 | CONFIRMED | Подключать широкий practical набор payment providers/methods | Exact provider set remains implementation/legal decision |
| C-009 | OPEN | Stored balance | Need business/legal reason |
| C-010 | CONFIRMED | Dispute system обязательна | Refund reasons/authority confirmed; detailed evidence windows remain policy design |
| C-011 | CONFIRMED | Payout design минимизирует owner operations/cost | Prefer provider-managed marketplace/split settlement where feasible |
| C-012 | CONFIRMED | Services/custom development marketplace входит в target | Round 4 |
| C-013 | CONFIRMED | Guarantee/Deal входит в target | Provider/legal gate before production |

## G. Subscriptions and paid features

| ID | Статус | Решение | Комментарий |
|---|---|---|---|
| SUB-001 | CURRENT | Follow subscription — бесплатная notification relation | Not billing |
| SUB-002 | CONFIRMED | Paid subscriptions нужны и могут существовать в разных pillars | Owner answer #7 |
| SUB-003 | CONFIRMED | One-time paid features/upgrades допустимы | Owner answer #7 |
| SUB-004 | CONFIRMED | Широкая monetization допустима | «Все можно использовать чтобы заработать» |
| SUB-005 | CONFIRMED | Creator Free + paid Creator tiers/capabilities | Manual moderation on Free; paid auto-publish/analytics/automation; exact price/quotas OPEN |
| SUB-006 | CONFIRMED | Server plan допустим | Exact features/pricing OPEN |
| SUB-007 | CONFIRMED | Organization Pro + maximal NEXUS Pro bundle | Organization billed per entity; NEXUS Pro combines all pillars; exact entitlement limits OPEN |
| SUB-008 | CONFIRMED | Auto-publish только subscription capability; может bypass manual queue | Mandatory automated safety/integrity/policy gates remain |
| SUB-009 | CONFIRMED | Promoted servers/resources допустимы | Clearly labeled; initial model fixed-price; availability may depend on subscription/tariff |

## H. DRM

| ID | Статус | Решение | Комментарий |
|---|---|---|---|
| DRM-001 | CURRENT | Active DRM не включён в closed beta | Runtime fact |
| DRM-002 | CONFIRMED | DRM capability обязательна в target commercial architecture | Seller opt-in per product |
| DRM-003 | LEGACY | Старый MTA Market DRM v2 — reference implementation/design | Reuse selectively |
| DRM-004 | CONFIRMED | DRM не позиционируется как абсолютная защита | Honest security framing |
| DRM-005 | CONFIRMED | Purchase → License → Installation/Server → Activation → Lease | Server/installation binding |
| DRM-006 | CONFIRMED | Offline grace = 7 days | After grace protected resource hard-stops |
| DRM-007 | CONFIRMED | DRM seller opt-in per product; runtime universal/reusable | No recompilation per customer/server |
| DRM-008 | OPEN | Watermark/forensics | Round 2 answer clarified module universality, not forensic policy |

## I. Community / Trust

| ID | Статус | Решение | Комментарий |
|---|---|---|---|
| CT-001 | CURRENT | Content/comments/follows/notifications уже часть NEXUS | Current code |
| CT-002 | CONFIRMED | Community должен быть крупным самостоятельным pillar | Owner answer #10 |
| CT-003 | CONFIRMED | Цель — увеличивать полезное время/возвращаемость пользователя | Not empty engagement |
| CT-004 | CONFIRMED | Trust layer можно расширять дополнительными evidence-backed badges/signals | Owner answer #11 |
| CT-005 | CONFIRMED | Global forum + server/resource discussions | Server/org owners may create managed community spaces; platform override remains |
| CT-006 | CONFIRMED | Activity feed + notifications are target surfaces | Personalization depth OPEN |
| CT-007 | CONFIRMED | Articles/news/devlogs/server updates/events/contests target | DMs required by first commercial version |
| CT-008 | CONFIRMED | Verification cannot be purchased | Evidence/history/experience based; appeal path required |

## J. AI development policy

| ID | Статус | Решение | Комментарий |
|---|---|---|---|
| AI-001 | CONFIRMED | AI читает current main перед изменением | Handoff rule |
| AI-002 | CONFIRMED | Code/migrations/tests выше legacy docs | Source precedence |
| AI-003 | CONFIRMED | Не заявлять pass без actual execution | Evidence discipline |
| AI-004 | CONFIRMED | Предпочитать coherent finished slices | Owner previous preference |
| AI-005 | CONFIRMED | AI сам выбирает следующие development tasks | Owner answer #12 |
| AI-006 | CONFIRMED | AI может refactor/architecture/features/dependencies/migrations/CI | Broad autonomy |
| AI-007 | CONFIRMED | AI может commit/push directly to `main` | Existing workflow + owner answer |
| AI-008 | CONFIRMED | Destructive production data and production deployment remain human gates | High-risk boundary |
| AI-009 | CONFIRMED | Реальные payment/legal activation changes remain human gate | Development foundation allowed |

## K. Следующие решения, которые нужно получить

Rounds 1–6 закрыли product strategy, monetization direction, trust, marketplace lifecycle, cart/billing UX, server/org ownership, messaging, public launch, dashboards, product page, security center, identity и navigation. Следующий уровень — **точная screen-level спецификация по ролям и policies вокруг lifecycle edge cases**:

```text
ROLE UI             Guest/User/Buyer/Seller/Server Owner/Org/Staff exact screens and actions
WORKSPACE IA        exact tabs, empty states, mobile behavior and context switching
SUBSCRIPTIONS       exact tier names, quotas, prices, expiry/downgrade/vanity-username behavior
NOTIFICATIONS       event matrix, channel defaults, Telegram/Discord bot actions
SUPPORT             routing, SLA, escalation, evidence/attachment policy
CONTENT             exact pre-moderation matrix, authoring permissions, forum hierarchy
ACCOUNT LIFECYCLE   deletion, suspension, data export, retention and ownership transfer on exit
DRM FORENSICS       seller-opt-in forensic watermarking CONFIRMED; evidence only, no automatic ban
API TIMING          when authenticated partner/Pro API actually ships
PRODUCTION          hosting, object storage/CDN, observability and release acceptance
LEGAL/FINANCE       launch jurisdictions, PSP/MoR contracts, KYC/tax/refund wording
```

Owner explicitly does not require a fixed implementation priority between Community, Marketplace, Server and DRM tracks. Engineering may choose dependency/risk-driven order and parallelize coherent work.

## L. Как обновлять register

1. Новое owner decision -> `CONFIRMED`.
2. Current implementation отдельно отмечать `CURRENT`, если target ещё не реализован.
3. Не использовать legacy как разрешение на feature без решения.
4. Обновлять связанные business/roadmap/AI-handoff главы.
5. При конфликте owner target и current runtime явно хранить оба слоя, а не стирать один из них.


## M. Owner review Round 3 — confirmed decisions

| ID | Статус | Решение | Комментарий |
|---|---|---|---|
| ADM-001 | CONFIRMED | Admin делится на специализированные operational departments | Users/Resources/Servers/Content/Trust/Finance/etc. |
| ADM-002 | CONFIRMED | Staff roles/capabilities отдельные и cumulative | One staff account may hold multiple roles |
| ADM-003 | CONFIRMED | Capability-scoped sanctions supported | User can lose selling etc. without full account ban |
| ADM-004 | CONFIRMED | Public SCAM/BLACKLIST status allowed after platform decision | Evidence + audit + appeal; not crowd accusation board |
| ADM-005 | CONFIRMED | Appeals required | Moderation, sanctions, verification, eligible disputes |
| ADM-006 | CONFIRMED | Public decisions expose substantive full reason | Safety/legal/PII redaction exception |
| REP-001 | CONFIRMED | Reputation uses multiple signals | Avoid opaque single-number truth |
| REP-002 | CONFIRMED | Paid reviews require verified purchase | Evidence label |
| REP-003 | CONFIRMED | Free resource reviews require claim/download eligibility | Evidence label |
| REP-004 | CONFIRMED | Review can be updated after later version | Preserve timestamps/context/history |
| REP-005 | CONFIRMED | Verification proves real history/experience/evidence | Cannot be purchased |
| SUB-010 | CONFIRMED | Specialized plans + umbrella NEXUS bundle both allowed | Creator/Server/Org/etc. |
| SUB-011 | CONFIRMED | Plan ladders may differ by pillar | No forced single universal tier model |
| SUB-012 | CONFIRMED | Paid entitlement term configurable ~7 days to 1 year | Prepaid/recurring architecture can coexist |
| SUB-013 | CONFIRMED | One-time monetization focuses ads/promotion/publishing ops | Not mainly cosmetic profile purchases |
| ADS-001 | CONFIRMED | Initial promotion is fixed-price | No auction/bidding initially |
| UX-001 | CONFIRMED | Home mixes search + live MTA + servers + resources + community + personalization | Balanced ecosystem |
| UX-002 | CONFIRMED | Global search spans servers/resources/users/orgs/articles/forum | Permission aware |
| UX-003 | CONFIRMED | Rich profiles + Pro customization | Trust badges protected from imitation |
| CT-009 | CONFIRMED | Server owners/orgs may create managed community spaces | Platform moderation override |
| CT-010 | CONFIRMED | Selected content uses pre-moderation | Ads/home/first new-account content/articles/server news/devlogs |
| NT-001 | CONFIRMED | Notifications target in-app/email/Web Push/Telegram/Discord | Preference/event aware |
| ABUSE-001 | CONFIRMED | New accounts have progressive anti-spam limits | DMs/topics/comments/reviews/resource submissions |
| COM-001 | CONFIRMED | Refund via dispute for mismatch/non-working/duplicate/fraud etc. | Exact windows/evidence OPEN |
| COM-002 | CONFIRMED | Internal disputes decided by authorized NEXUS staff | PSP/bank chargeback handled/reconciled externally |
| DRM-009 | CONFIRMED | One free license transfer about every 30 days | Extra/exceptional transfer via support |
| DRM-010 | CONFIRMED | After 7-day grace protected resource hard-stops | Clear recoverable status expected |
| DRM-011 | CONFIRMED | Minimal DRM telemetry | No hardware fingerprint unless separately justified |
| RES-001 | CONFIRMED | Marketplace supports open-source and closed-source products | Source can be separate higher-priced SKU/license |
| AI-010 | CONFIRMED | AI may choose safe reversible unresolved details as PROVISIONAL | Record decision and continue; high-risk/irreversible gates remain human |

## N. Remaining high-value open decisions after Round 4

```text
BUSINESS/LEGAL      launch jurisdictions, providers, currencies, tax/VAT/invoicing
PRICING             exact tier names/prices, inventory capacity, included quotas
PAYOUTS             fee allocation, reserves, settlement timings, seller KYC onboarding
MODERATION          SLA/escalation thresholds, exact blacklist eligibility, appeal deadlines
VERIFICATION        per-type evidence thresholds and renewal/revocation periods
DRM FORENSICS       optional leak watermark/fingerprinting design
MESSAGING           contact defaults, attachment policy, block/privacy/retention
PRODUCTION          hosting, object storage/CDN, observability and release acceptance
```

## O. Marketplace product rules — Round 4

| ID | Статус | Решение | Комментарий |
|---|---|---|---|
| MP-001 | CONFIRMED | Первый коммерческий фокус — MTA Scripts | Другие digital categories могут добавляться позже |
| MP-002 | CONFIRMED | Основные delivery variants: closed code и open source | Closed code может использовать seller-opt-in DRM; open source — без DRM |
| MP-003 | CONFIRMED | Seller сам назначает цену | Hard minimum price не вводится как product rule; provider/currency limits допустимы |
| MP-004 | CONFIRMED | Free + Premium edition разрешены | Один продукт может иметь бесплатный и платный уровень |
| MP-005 | CONFIRMED | Bundles разрешены | Несколько ресурсов/прав в одной покупке |
| MP-006 | CONFIRMED | Coupons, promo codes и seller/NEXUS discounts разрешены | Discount truth должна быть прозрачной |
| MP-007 | CONFIRMED | Покупатель получает будущие обновления без отдельной оплаты | Major-version paid upgrade не является default model |
| MP-008 | CONFIRMED | Changelog/version history обязательны | Особенно для commercial resources |
| MP-009 | CONFIRMED | Base payout hold = 7 дней | Может сокращаться/меняться по subscription + verification/trust policy |
| MP-010 | CONFIRMED | PSP fee allocation зависит от provider | Не хардкодить единое правило |
| MP-011 | CONFIRMED | 10% NEXUS commission считается от фактически оплаченной суммы после скидки | Tax/PSP edge cases специфицируются отдельно |
| MP-012 | CONFIRMED | Seller не делает unilateral refund | Refund идёт через policy/authorized flow |
| MP-013 | CONFIRMED | Seller analytics обязательна | Revenue/views/conversion/refunds/geography/downloads/support etc. с privacy controls |
| MP-014 | CONFIRMED | Services/custom development входят в коммерческую модель | Не только downloadable scripts |
| MP-015 | CONFIRMED | Deal / Guarantee нужны | Protected payment + evidence + dispute + settlement |
| MP-016 | CONFIRMED | Seller/Publishing Agreement принимается перед первой продажей | Точный legal текст — отдельный human/legal gate |
| MP-017 | CONFIRMED | Отдельной продуктовой age-policy не вводим сейчас | Закон/PSP/юрисдикция могут всё равно требовать возрастные ограничения |

## P. Servers / Organizations / Profiles — Round 4

| ID | Статус | Решение | Комментарий |
|---|---|---|---|
| SO-001 | CONFIRMED | После claim владелец получает широкую свободу оформления server page | В пределах safety/design constraints |
| SO-002 | CONFIRMED | Публичный team roster нужен | Owner/Admin/Developer/Moderator/Support и расширяемые роли |
| SO-003 | CONFIRMED | Server pages поддерживают recruitment, vacancies, factions/clans, applications, events | Это часть retention ecosystem |
| SO-004 | CONFIRMED-DELEGATED | Server trust/ranking — гибрид сигналов, не только stars | Verified reviews + activity/uptime + follows + trust + moderation signals |
| SO-005 | CONFIRMED | Promotion сервера зависит от subscription/product inventory | Может входить в plan и/или покупаться отдельно согласно тарифу |
| SO-006 | CONFIRMED | Organization — универсальная team/business entity | Studio, server team, development team, business/community org |
| SO-007 | CONFIRMED | User может быть участником нескольких organizations | Разные роли/permissions per org |
| SO-008 | CONFIRMED | Organizations имеют invites, granular permissions, ownership transfer, billing owner, audit log | Full team governance |
| SO-009 | CONFIRMED | Публичность профиля настраивается пользователем | Activity/purchases/servers/resources/org memberships etc. |

## Q. Community / discovery — Round 4

| ID | Статус | Решение | Комментарий |
|---|---|---|---|
| CD-001 | CONFIRMED | Direct messages нужны к первой коммерческой версии | Anti-abuse/rate limits mandatory |
| CD-002 | CONFIRMED | Пользовательские groups/clans нужны отдельно от Organization/server | Social/community entity |
| CD-003 | CONFIRMED | Forum/editor поддерживает Markdown, code, images/files, embeds, polls, reactions, mentions, bookmarks | Санитизация и content policy mandatory |
| CD-004 | CONFIRMED | Events/contests создают только определённые eligible actors | Verified/server/org/staff policy; exact matrix configurable |
| CD-005 | CONFIRMED | Achievements, levels, seasonal badges и community awards допустимы | Trust badges нельзя покупать |
| CD-006 | CONFIRMED | Server discovery сочетает ranking и filters | Не превращать единую формулу в единственный путь discovery |
| CD-007 | CONFIRMED | Marketplace ranking использует relevance/sales/rating/freshness/update frequency/seller trust | Signals должны быть explainable enough for abuse control |
| CD-008 | CONFIRMED-DELEGATED | Sponsored может появляться внутри выдачи только в фиксированных слотах с явным `Sponsored` | Никогда не меняет organic rank/trust/security truth |
| CD-009 | CONFIRMED | Персональные рекомендации нужны | Interests/follows/browsing/purchases с privacy controls |
| CD-010 | CONFIRMED-DELEGATED | Personalization можно полностью отключить | Fallback — neutral recent/trending/filters |
| CD-011 | CONFIRMED | Daily-return surface — персонализированный mix news/servers/market/community/notifications | Homepage/feed goal |
| CD-012 | CONFIRMED | Успех измеряется общей системой ecosystem metrics | Active users + servers + sellers + GMV + community activity + meaningful time |

## R. Enforcement / transparency — Round 4

| ID | Статус | Решение | Комментарий |
|---|---|---|---|
| ENF-001 | CONFIRMED | SCAM/BLACKLIST verdict бессрочен до пересмотра | Appeal/manual review может изменить решение |
| ENF-002 | CONFIRMED | Public Transparency page нужна | Aggregate bans/appeals/scam/malware/disputes etc.; no unnecessary PII |

## Q. Owner review Round 6 — confirmed decisions

| ID | Статус | Решение | Комментарий |
|---|---|---|---|
| UX-004 | CONFIRMED | После login пользователь остаётся на обычной Home | Dashboard не является forced landing |
| WS-001 | CONFIRMED | Используется единый адаптивный `/workspace` | Multi-role user, context-aware navigation |
| WS-002 | CONFIRMED | Seller dashboard включает полный professional набор | Revenue/payouts/sales/conversion/health/reviews/disputes/support/promotion/subscription |
| WS-003 | CONFIRMED | Server Owner dashboard включает полный management/analytics набор | Live/history/incidents/team/apps/content/reviews/promotion/analytics |
| WS-004 | CONFIRMED | Organization dashboard объединяет members/resources/servers/billing/payout/audit/support/deals | Organization — полноценный actor |
| LIB-001 | CONFIRMED | Buyer Library делится на Purchased/Free/Trials/Licenses/Updates/Support/Invoices | Unified ownership view |
| PUR-001 | CONFIRMED | У каждого purchase/order item есть detail page | License/server binding/downloads/update/invoice/support/dispute |
| PRD-001 | CONFIRMED | Product page показывает commercial/trust/delivery state above the fold | Price/seller/reviews/version/source/DRM/cart/trial; compatibility when available |
| PRD-002 | CONFIRMED | Catalog cards показывают Open Source / Closed Source / DRM Protected | Delivery model visible early |
| PRD-003 | CONFIRMED | Seller может использовать rich media и demo links | Screenshots/video/GIF/embed/demo server under content policy |
| COMP-001 | CONFIRMED | Compatibility metadata не обязательна для каждого product | Structured optional data |
| COMP-002 | CONFIRMED | Dependency graph нужен | Required/optional/bundled/external dependencies visible before purchase |
| COMP-003 | CONFIRMED | Automatic server-compatibility inference не требуется | Не создавать ложную intelligence |
| DEL-001 | CONFIRMED | После delist обычные новые releases запрещены | Product frozen; security handling идёт через platform process |
| DRM-012 | CONFIRMED | После 30-day redownload window активная DRM-license живёт до конца договорного оплаченного срока | Malware/legal/security revocation может supersede |
| FREE-001 | CONFIRMED | Safe free builds можно хранить дольше 30 дней | Archive/retention policy separate from paid delist window |
| SUP-001 | CONFIRMED | Subscription может улучшать операционный support priority | Никогда не влияет на dispute/moderation fairness |
| SUP-002 | CONFIRMED | Pre-sale support доступен любому пользователю; seller messaging также допустим | Unified support + messaging |
| REP-006 | CONFIRMED | Seller response time/support satisfaction не являются обязательным публичным reputation signal | Можно хранить internal analytics |
| FEED-001 | CONFIRMED | Home использует конечные секции + `Показать больше` | Не infinite-scroll Home |
| FEED-002 | CONFIRMED | Отдельная Community Feed может использовать infinite scroll | Cursor/permission/moderation aware |
| DISC-001 | CONFIRMED | Нужна отдельная `/discover` | Cross-ecosystem entry point; Round 8 presentation uses separate entity sections, not mixed stream |
| ID-009 | CONFIRMED | Public profile открыт по умолчанию на безопасных public fields | Private/security/payment data никогда не публикуются автоматически |
| ID-010 | CONFIRMED | Immutable User ID — primary identity; subscription/eligible entitlement может добавить vanity username | Round 7 supersedes rename policy: смена username — отдельная платная операция; slug освобождается после 7-day grace |
| ID-011 | CONFIRMED | Verified external links нужны | GitHub/Discord/domain/etc.; proves control, not quality |
| ADM-007 | CONFIRMED | Admin global case search нужен | User/server/resource/order/payment/license/IP/audit ID with permissions |
| FIN-001 | CONFIRMED | Raw PSP/provider payload доступен отдельно от normalized finance UI | Restricted debug capability + audit |
| SEC-001 | CONFIRMED | Quarantine build/resource нужна | Stop download/activation without immediate physical deletion |
| SEC-002 | CONFIRMED | Malware incident уведомляет affected downloaders | Removal alone is insufficient |
| SEC-003 | CONFIRMED | User Security Center нужен | Sessions/devices/login history/2FA/recovery/security alerts |
| SEC-004 | CONFIRMED | 2FA не является обязательной только из-за роли | Strong recommendation/step-up allowed |
| API-001 | CONFIRMED | API keys/webhooks не являются launch requirement | Future Pro/partner capability |
| API-002 | CONFIRMED | При появлении API сначала authenticated partners/Pro | Anonymous public API не открывать на первом этапе |
| OPS-001 | CONFIRMED | Отдельная public NEXUS Status Page сейчас не нужна | Internal observability/incident response всё равно required |
| NAV-001 | CONFIRMED | Top-level navigation: Home / Servers / Market / Community / Messages / Notifications / Workspace/Profile | Discover remains required secondary/top-level surface |

### Round 6 interpretation notes

- Ответ `R6-33: Только` интерпретирован как **только authenticated partner/Pro API при первом внешнем API**, а не anonymous read-only API для всех. Это согласуется с `R6-32: API keys/webhooks не нужны к первой commercial release`.
- Ответ Round 6 про username сохраняет **immutable ID first + entitlement-bound vanity username**. Round 7 уточнил lifecycle: смена vanity username допускается как отдельная платная операция, а historical identity/audit всё равно остаётся anchored на immutable User ID.

## N. Owner review Round 7 — confirmed decisions

| ID | Статус | Решение | Комментарий |
|---|---|---|---|
| ACC-001 | CONFIRMED | Guest can read all public ecosystem surfaces | Account required for actions |
| ACC-002 | CONFIRMED | Verified email required for essentially all state-changing user actions | Reading/login/recovery exceptions |
| ACC-003 | CONFIRMED | Email/password is primary login | Social accounts are verified identity links, not login providers |
| ACC-004 | CONFIRMED | Self-service `Export my data` UI not required | Legal access obligations remain separate |
| ACC-005 | CONFIRMED | Account deletion archives owned surfaces automatically | Mandatory legal/financial/audit retention remains |
| ID-001 | CONFIRMED | Vanity slug is released when entitlement ends | Immutable User ID persists |
| ID-002 | CONFIRMED | Vanity username change is a separate paid operation | Not free/support-only rename |
| BUY-001 | CONFIRMED | Guest cart allowed; auth+server revalidation required before checkout | No anonymous payment completion |
| LIC-001 | CONFIRMED | Paid license binds to server after purchase | 1 license = 1 server remains |
| LIC-002 | CONFIRMED | Unbound paid license activation window = 30 days | Not indefinite |
| LIC-003 | CONFIRMED | Trial binds to one server and has short/limited entitlement | Anti-abuse required |
| DL-001 | CONFIRMED | Download page exposes SHA-256/scan/signature/provenance details | Manual verification surface |
| SUP-001 | CONFIRMED | Support/dispute attachments allowed with scan/type controls | Images/text/logs/safe archives |
| PUB-001 | CONFIRMED | Publish Wizard fixed staged flow | Basic -> Delivery -> Files -> Dependencies -> Media -> Price -> DRM -> Support -> Preview -> Submit |
| KYC-001 | CONFIRMED | Seller can draft before KYC; KYC required before first payout | Provider may require earlier |
| PUB-002 | CONFIRMED | Auto-publish requires clean risk state and can be revoked by staff | Safety gates remain mandatory |
| PUB-003 | CONFIRMED | Seller can Unlist; archive/takedown preserves history | Audit/purchases immutable |
| PUB-004 | CONFIRMED | Archived/delisted product page normally remains public with reason | No purchase CTA |
| ORG-001 | CONFIRMED | `manage_products` separate from payout/billing capabilities | Finance/Owner protect money settings |
| SRV-001 | CONFIRMED | Server customization uses safe blocks/media/colors, no arbitrary HTML/CSS/JS | Rich but sandboxed |
| SRV-002 | CONFIRMED | Recruitment forms support safe fields/custom questions | Private-by-default applications |
| SRV-003 | CONFIRMED | Server edit/ownership history only owner/staff | Public announcements separate |
| ANA-001 | CONFIRMED | Join analytics may include hidden/internal technical telemetry | Must still satisfy privacy/legal/purpose limits |
| ORG-002 | CONFIRMED | Permission templates + granular custom capabilities | Owner/Admin/Developer/Support/Finance/Content |
| ORG-003 | CONFIRMED | Critical org actions require re-auth + audit | Ownership/payout/finance rights/deletion |
| ORG-004 | CONFIRMED | Invite links with expiry/max uses required | Personal invites remain |
| ADM-007 | CONFIRMED | One senior Trust/Admin can issue SCAM/BLACKLIST verdict | Evidence/audit/appeal mandatory |
| FIN-001 | CONFIRMED | No universal dual-control requirement for large refunds/manual payout corrections | Provider/risk policy may add later |
| MOD-001 | CONFIRMED | Moderation case has unified timeline | report -> evidence -> action -> appeal -> final/public reason |
| MOD-002 | CONFIRMED | Staff notes have internal/user/public audiences | Prevent accidental disclosure |
| MOD-003 | CONFIRMED | Staff queues have priority/escalation | Critical Malware/Payment/Scam/Appeal/Normal |
| NOTIF-001 | CONFIRMED | Telegram/Discord bots deferred | Email is outbound baseline; in-app/Web Push also target |
| NOTIF-002 | CONFIRMED | Security/payment/legal notices cannot be fully disabled | Community/marketing configurable |
| MSG-001 | CONFIRMED | DM attachments allowed with safe type/scan policy | No ordinary executable delivery |
| PWA-001 | CONFIRMED | Installable PWA + Web Push + offline shell target public release | State changes still server-authoritative |
| UX-004 | CONFIRMED | Light/Dark/System themes | Release target |
| A11Y-001 | CONFIRMED | WCAG 2.2 AA target for key account/commerce flows | Higher than current baseline |
| UX-005 | CONFIRMED | Mobile bottom nav Home/Servers/Market/Community/More | Messages/Notifications/Workspace in More/header |
| DATA-001 | CONFIRMED | Retention differs by record type/legal purpose | No single TTL |
| SEC-001 | CONFIRMED | User-facing Activity & Security Log required | Login/session/purchase/license/ownership critical actions |

## O. Remaining owner-level design questions after Round 7

The next round should focus on **screen-level role interfaces and exact daily workflows**, not repeat settled architecture:

- Guest/Home/Discover exact modules and CTAs;
- User/Profile/Community exact screens;
- Buyer Library and purchase detail IA;
- Seller dashboard exact cards/tables/primary actions;
- Server Owner dashboard exact navigation/page builder/status workflows;
- Organization workspace context switching and billing/admin separation;
- Moderator/Support/Finance/Admin queue screens and action confirmations;
- exact subscription products/quotas/prices;
- support routing/SLA wording;
- content/forum hierarchy and premode matrix;
- API shipping milestone;
- production hosting/CDN/observability vendor choices;
- legal launch jurisdictions/PSP contracts remain human business gates.

## P. Owner review Round 8 — screen-level confirmed decisions

| ID | Статус | Решение | Комментарий |
|---|---|---|---|
| HOME-001 | CONFIRMED | Guest Home starts with global search + ecosystem summary | Servers/Market/Community/Events follow |
| HOME-002 | CONFIRMED | `Trending now` module required | Not a secret paid ranking |
| DISC-002 | CONFIRMED | Discover has no heterogeneous mixed stream | Entity tabs/sections with entity-specific filters |
| HOME-003 | CONFIRMED | Guest cards use contextual CTAs | Avoid registration-wall UX |
| PROF-001 | CONFIRMED | Profile tabs: Overview/Activity/Resources/Servers/Organizations/Reviews/Achievements | Public-safe data only |
| PROF-002 | CONFIRMED | Public Activity is a feed/timeline | Underlying privacy/visibility governs entries |
| PROF-003 | CONFIRMED | Separate public Trust/Reputation tab | Shows evidence/history rather than a single reputation score |
| COM-001 | CONFIRMED | Community IA: Feed/Forum/Articles/Events/Groups | Managed server/org hubs supported |
| BUY-002 | CONFIRMED | Buyer landing is action-oriented | Purchases, pending activation, updates, support/disputes, wishlist |
| BUY-003 | CONFIRMED | Purchase detail uses tabs | Overview/Downloads/License/Updates/Support/Invoice/Dispute |
| LIC-004 | CONFIRMED | 30-day activation deadline reminders at 7/3/1 days | Notification channels per user policy |
| CART-002 | CONFIRMED | Target server may be selected in cart but is optional | Final binding server-authoritative |
| SEL-001 | CONFIRMED | Seller dashboard KPI + Product Health/action queue | Professional operations view |
| SEL-002 | CONFIRMED | Seller Products table approved columns | Status/version/price/sales/rating/support/DRM/update/risk |
| PUB-005 | CONFIRMED | Publish Wizard is full-page | Not modal/drawer |
| ANA-002 | CONFIRMED | Seller Analytics includes funnel/source/comparison/revenue/refunds/downloads/updates | Date-range capable |
| ADS-001 | CONFIRMED | Dedicated Promotions Manager required | Fixed-price boosts/featured/campaign history |
| SUP-003 | CONFIRMED | Seller Support is unified inbox | Pre-sale + buyer context |
| SRV-004 | CONFIRMED | Server Dashboard approved live/analytics/action modules | Live, 24h/7d, joins, follows, trust, incidents |
| SRV-005 | CONFIRMED | Server page builder is visual block editor | Desktop/mobile preview; safe sandboxed blocks |
| SRV-006 | CONFIRMED | Incidents/Maintenance/Events managed separately | May share public chronology |
| SRV-007 | CONFIRMED | Recruitment pipeline: New/Reviewing/Interview/Accepted/Rejected | Private applications |
| AUTHZ-001 | CONFIRMED | Server team uses same capability engine as Organizations | Avoid duplicated auth model |
| ORG-005 | CONFIRMED | Active Organization switches unified Workspace context | Personal context remains accessible |
| ORG-006 | CONFIRMED | Organization Overview approved modules | Members/assets/subscription/revenue/support/deals/audit |
| ORG-007 | CONFIRMED | Organization Finance is separate surface/capability | Money permissions isolated |
| ORG-008 | CONFIRMED | Organization public storefront/portfolio required | Team/resources/servers/content/reviews |
| STAFF-001 | CONFIRMED | Role-aware Staff Home required | Cases/SLA/critical queues/high-risk actions |
| STAFF-002 | CONFIRMED | Case detail has summary + evidence/timeline + action/reason | Unified case model |
| STAFF-003 | CONFIRMED | Impact preview before high-impact actions | Users/downloads/licenses/payments/notifications |
| STAFF-004 | CONFIRMED | Support financial/trust access is capability-restricted | Principle of least privilege |
| STAFF-005 | CONFIRMED | Finance cannot moderate without moderation capability | Separated duties |
| SYS-001 | CONFIRMED | Emergency Super Admin tools live in separate `System` area | reason + re-auth + audit |
| PRICE-001 | CONFIRMED | Single public `/pricing` compares product families | Creator/Server/Organization/NEXUS bundle |
| PRICE-002 | CONFIRMED | Commission/hold-time/plan advantages disclosed transparently | No hidden economics |
| SUB-001 | CONFIRMED | Plan-only automation/promotions stop on expiry; config retained | Resubscribe without rebuilding setup |
| ID-003 | CONFIRMED | Vanity username grace after entitlement expiry = 7 days | Then slug released |
| PWA-002 | CONFIRMED | Offline PWA blocks state-changing sensitive actions | Explicit Offline state |
| ERR-001 | CONFIRMED | Production errors expose correlation/request ID, never stack trace | Support-safe diagnostics |


## R. Owner review Round 9 — economics, trust, content moderation, DRM and production rules

| ID | Статус | Решение | Комментарий |
|---|---|---|---|
| ECON-001 | CONFIRMED | Current baseline marketplace commission is 10% for all sellers | Future Creator subscriptions may reduce commission; exact reductions are OPEN |
| ECON-002 | CONFIRMED | New-seller payout hold starts at 7 days | Subscription/verification/good history may shorten it toward 1–3 days |
| ECON-003 | CONFIRMED | Creator Free exists | Base selling with manual moderation remains possible without subscription |
| ECON-004 | CONFIRMED | Paid Creator capabilities may include auto-publish/advanced analytics/automation/promotion | Mandatory safety gates never bypassed |
| ECON-005 | CONFIRMED | One-off paid accelerated/automated publication allowed | Security, integrity and content-policy gates remain mandatory |
| ECON-006 | CONFIRMED | Server paid offering may use multiple tiers plus one-time purchases | Exact names/prices/quotas remain OPEN |
| ECON-007 | CONFIRMED | Organization subscription is billed per organization | Not per-seat by default |
| ECON-008 | CONFIRMED | NEXUS Pro is the maximal cross-ecosystem bundle | Can cover Creator/Server/personal/organization advantages subject to exact entitlement limits |
| ECON-009 | CONFIRMED | Base subscription prices are globally consistent | Local currency display/conversion allowed; no hidden regional price matrix initially |
| TRUST-001 | CONFIRMED | Dedicated public Trust/Reputation profile tab | Evidence set, not one opaque score |
| TRUST-002 | CONFIRMED | Exact successful sales/deals counts may be public | Privacy-sensitive financial amounts remain private |
| TRUST-003 | CONFIRMED | Finalized public moderation history is retained historically | Internal notes/evidence/security-sensitive detail stay restricted |
| MOD-001 | CONFIRMED | First forum topic from a new account requires premoderation | Healthy history may unlock immediate publish |
| MOD-002 | CONFIRMED | Paid ads/featured content require content-policy review before display | Payment never buys policy bypass |
| MOD-003 | CONFIRMED | Articles/guides are trust-tiered | Low/new trust premoderated; established healthy authors use post-moderation |
| MOD-004 | CONFIRMED | Claimed-server news/devlogs may publish immediately without active risk flags | Still reportable/reviewable |
| MOD-005 | CONFIRMED | Events/contests limited to eligible actors with selective moderation | Verified/server/org/staff or explicitly allowed actors |
| MOD-006 | CONFIRMED | Quotas/limits exist across all trust levels | Trust may raise limits but does not create unlimited bypass, including finance/security |
| LIC-010 | CONFIRMED | Products may use perpetual or time-limited licenses/subscriptions | Seller chooses allowed commercial model |
| LIC-011 | CONFIRMED | Perpetual DRM license is indefinite after valid activation | 7-day offline lease grace is connectivity tolerance, not license expiry |
| DRM-010 | CONFIRMED | Seller-opt-in forensic watermark/fingerprint layer | Individual package/marker without per-customer runtime recompilation |
| DRM-011 | CONFIRMED | Leak marker is evidence, not automatic guilt | Staff investigation/case required |
| DRM-012 | CONFIRMED | Seller sees leak suspicion/status but not detection algorithms/raw sensitive signals | Protect anti-abuse system |
| DRM-013 | CONFIRMED | Seller license revoke requires formalized allowed reason | No arbitrary one-click revoke |
| SUP-010 | CONFIRMED | NEXUS does not promise hard public hourly SLA before a staffed operation exists | Critical security remains highest priority |
| SUP-011 | CONFIRMED | Seller promises support duration, not mandatory response-time SLA | Product may advertise stronger voluntary terms later |
| DSP-010 | CONFIRMED | Disputes use internal target handling times | Missing target never auto-awards either party |
| PAY-010 | CONFIRMED | Payment layer remains provider-agnostic until production business/legal gate | Jurisdiction/legal entity/PSP contracts selected later |
| STOR-010 | CONFIRMED | Production commercial files use private object storage + signed CDN URLs | Local filesystem dev/test fallback only |
| SCAN-010 | CONFIRMED | ClamAV is baseline behind pluggable scanner/reputation adapters | Additional engines may be added without changing product workflow |
| OBS-010 | OPEN | Who may choose the concrete production observability vendors | Required observability functions are known; owner did not understand/approve R9-30 |

## S. Remaining owner-level questions after Round 9

The handbook now covers the core product, business, trust, licensing, moderation and role-screen contracts. Remaining owner decisions are narrow and should not block ordinary implementation:

- exact subscription prices, quotas and commission reductions;
- exact payout-hold reduction table and eligibility thresholds;
- exact one-off publication/promotion prices;
- final legal entity, launch jurisdiction, Terms/Privacy/Seller Agreement wording and tax/accounting setup;
- real payment provider contracts and supported payment methods by launch country;
- exact retention durations once jurisdiction is chosen;
- exact production hosting/email/object-storage/CDN vendors;
- `OBS-010`: whether AI may provisionally choose reversible observability vendors/tools;
- final repository documentation policy needed to merge this handbook into `main`;
- final brand slogan and a single North Star metric if the project wants one.