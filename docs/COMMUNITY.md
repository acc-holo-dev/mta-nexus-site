# Community, identity и social — предметный контракт

**Статус:** living · предметный контракт (сообщество / identity).  
**База DOC-05:** `385e577e7443cf7d7b817419ce5c3b8afe87b690`.  
Реестр ID — [DECISIONS](DECISIONS.md) / [13-DECISION-REGISTER](handbook/13-DECISION-REGISTER.md).  
Смежное: [FLOWS](FLOWS.md), [RETENTION-PLAN](RETENTION-PLAN.md), [TRUST-STAFF](TRUST-STAFF.md).

| Метка               | Значение                  |
| ------------------- | ------------------------- |
| **Текущий runtime** | Код на базе сверки        |
| **Цель**            | Owner target              |
| **Предложение**     | Без обязательства         |
| **Live unknown**    | Нужно свидетельство среды |

## Цель

Community — самостоятельный pillar с MTA-ценностью и возвращаемостью, не пустой engagement (**цель**). Entity-linked graph: topic/article/update/event ↔ User, Org, Server, Resource, Version/Release, Event — не изолированный форум.

**Hard rule:** Organization, gallery, LibraryCollection и support case **не** делают готовыми groups/clans, user DM, calendar events или social messaging.

## Акторы и identity

| Правило                                                                                                                         | Статус                |
| ------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Immutable User ID — главный якорь                                                                                               | **Цель**              |
| Username уникален при регистрации; `/users/[username]`                                                                          | **Runtime**           |
| Vanity username — платная customization, не identity; смена — отдельная платная операция; grace 7 дней после потери entitlement | **Цель**              |
| Login = email/password; Discord/GitHub/… — verified links, не login providers                                                   | **Цель**              |
| State-changing public actions требуют verified email (с явными recovery exceptions)                                             | **Цель**              |
| Профиль public по умолчанию только для public-полей; email/payment/IP/mod evidence никогда авто-публичны                        | **Цель**              |
| Privacy toggles activity/contacts; не полный private account                                                                    | **Runtime** (FLOW-15) |

Cosmetic purchase **не** покупает Verified Seller/Developer/Server/Org, Clean Build, staff, SCAM removal, review authenticity.

## Happy path (runtime)

| Поверхность                        | Runtime                                                              |
| ---------------------------------- | -------------------------------------------------------------------- |
| `/community` (+ `/community/new`)  | `post` / `question`; комментарии; editorial `/articles`              |
| Follows + inbox + Web Push         | Да; follow ≠ release watch ≠ discussion follow                       |
| Reactions                          | Ограниченный набор; write/delete + `X-Nexus-Actor-Id`                |
| Content create `POST /api/content` | Требует `X-Nexus-Actor-Id`; exact retry после неопределённого ответа |
| Reviews resource/server/plan       | Eligibility по доступу; author/managers exclude; FLOW-18             |
| Plan review write                  | `X-Nexus-Actor-Id`; sessionStorage retry; **не** активирует оплату   |

Отдельного `/forum`, Events/Groups hub, calendar social events, user DM **нет**.

## Target IA (`/community`) — **цель**

Секции: `Feed / Forum / Articles / Events / Groups`.

| Секция   | Правило                                                                            |
| -------- | ---------------------------------------------------------------------------------- |
| Feed     | Отделён от Home; не marketplace/server search                                      |
| Forum    | Categories → Boards → Topics → Posts; managed spaces в том же permission framework |
| Articles | Long-form; часть классов — premoderation                                           |
| Events   | Только eligible actors; не «купить рекламой»                                       |
| Groups   | Public/invite-only; **≠** Organization / server ownership                          |

Managed spaces: local moderators в granted caps; **NEXUS platform override + audit**. Modes: pre/post moderated, trusted auto-publish, staff_only, organization_managed. Paid advertising всегда review до показа.

## Reputation / verification / reviews

Три разных понятия (**цель**): Verification (evidence claim), Reputation (multi-signal history), Reviews (eligible feedback). **Ничего нельзя купить как truth.**

| Тема                                                          | Runtime  | Цель                                                                                                        |
| ------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------- |
| Flags `isVerified` / org/server verified / `reputation_score` | Частично | Multi-signal inspectable; не один opaque score как единственная правда                                      |
| verification_requests + staff                                 | Да       | Полный badge set с documented meaning + revoke/appeal                                                       |
| Resource/server reviews                                       | Да       | Evidence labels (`Verified Purchase`, …); update history; negative legitimate не снимается seller complaint |
| Follow/access                                                 | —        | **Не** доказывают установку или игровую сессию                                                              |

## Messaging / groups / events — границы

| Capability               | Runtime               | Цель / правило                                                                                               |
| ------------------------ | --------------------- | ------------------------------------------------------------------------------------------------------------ |
| User DM                  | Нет                   | 1:1 к commercial version; Message Request для незнакомцев; block/mute/report; executables через DM запрещены |
| Support cases            | Да                    | **Не** social DM                                                                                             |
| Groups/clans             | Нет                   | Отдельно от Org/Server; без auto commercial ownership                                                        |
| Community editor toolkit | Частично              | Markdown/code/images/polls/mentions/bookmarks + sanitize                                                     |
| Events/contests          | Нет                   | Eligible actors only                                                                                         |
| Achievements             | Нет                   | Допустимы; ≠ verification/trust for sale                                                                     |
| Progressive anti-abuse   | Частичные rate limits | Limits снимаются trust signals, **не только** оплатой подписки                                               |

Voice/video calls NEXUS **не** строит. Telegram/Discord notification bots **отложены** (не release gate текущего этапа).

## Уведомления (community scope)

**Runtime:** in-app categories, preferences, Web Push, durable workers.  
**Цель channels этапа:** in-app, email, Web Push. Mute/snooze объекта — **предложение** (FLOW-05).  
**Live unknown:** реальная доставка push/email на production host.

## Profile IA (**цель**)

Tabs: `Overview / Activity / Resources / Servers / Organizations / Reviews / Achievements / Trust`. Activity — только public; никогда private purchases/support/disputes/staff internals. Trust tab без private amounts / sensitive evidence.

**Runtime:** `/users/[username]` (+ activity, trust), ресурсы/серверы, follow — без полного tab set и без Message CTA social DM.

## Ошибки и non-goals

- Не объявлять groups/DM/events готовыми по факту support/org.
- Не продавать verification / review authenticity / SCAM removal / staff.
- Не выдавать `reputation_score` за единственную правду.
- Не считать Forum ready, пока нет Categories/Boards IA.
- Не смешивать seller support inbox с social DM.

## Открытые стыки

1. Runtime username обязателен vs цель «ID + optional vanity» — миграция slug не закрыта.
2. Exact DM default quotas — configurable OPEN.
3. Server review: цель verified interaction vs runtime follow + public/active.
4. Personalization depth / exact event eligibility — direction CONFIRMED, детали OPEN.

## Связь с источниками

Исторический смысл глав 19/21/27/36/45 — в Git @ `385e577e…`. Актуальный контракт — этот файл после DOC-04.
