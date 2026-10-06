# MTA NEXUS — интервью владельца проекта

> Статус: owner interview; rounds 1–4 answered 2026-10-06, remaining questions continue product specification.  
> Можно отвечать частями. Формат: `Q01: ...`, `Q02: ...`.


## Уже подтверждено владельцем — Round 1

1. MTA NEXUS — **единая площадка для всего сообщества MTA**.
2. Главная аудитория — все пользователи сайта; pillars должны быть равноправны.
3. Сервер не должен поглощать остальные направления: система равномерная.
4. Платные ресурсы нужны.
5. Marketplace commission — **10%**.
6. Обязательной seller application нет; модерируется продукт. Round 2 уточнил: auto-publish доступен только по подписке, manual queue может bypass, automated safety — нет.
7. Подписки могут существовать в разных областях; допустимы и разовые платные функции.
8. Монетизация может использовать практически любые полезные surfaces; точные честные/safety границы ещё специфицируются.
9. DRM capability обязательна для commercial architecture; Round 2 уточнил seller opt-in per product.
10. Community должен быть большим: цель — давать пользователю много полезных причин проводить время внутри сайта.
11. Trust layer можно расширять дополнительными verification/evidence signals, если они имеют смысл.
12. AI получает широкую development-автономию; human gates остаются для production/destructive/high-risk financial activation.

---


## Уже подтверждено владельцем — Round 2

1. Все public master-list servers отображаются; claim добавляет management.
2. Server Pro может включать весь предложенный professional feature set.
3. Sponsored/boosted placement servers/resources разрешён.
4. Auto-publish только по подписке; manual queue можно bypass, automated safety нельзя.
5. Хорошая история сама по себе auto-publish не открывает.
6. Любой registered user может продавать; verification профиля — отдельный trust layer.
7. Payment architecture должна поддерживать максимально широкий practical набор methods/providers.
8. Payout/settlement выбирается так, чтобы минимизировать ручные операции/расходы owner; provider-managed split preferred where feasible.
9. Disputes обязательны.
10. Protected lifecycle: Purchase → License → Installation/Server → Activation → Lease.
11. Offline DRM grace = 7 дней.
12. Seller сам включает DRM для продукта.
13. DRM runtime/module universal: один compiled module используется на множестве серверов; individualization через licenses/config/keys.
14. Community включает forum/entity discussions/articles/news/devlogs/server updates/feed/notifications/events/contests; DMs required by first commercial version.
15. Некоторые discussion/content types требуют pre-moderation.
16. Evidence-backed badges развиваются.
17. Verification нельзя покупать; она доказывает опыт/контроль/историю.
18. Owner не задаёт жёсткий priority major pillars — важен завершённый результат.

## Уже подтверждено владельцем — Round 4

1. Первый commercial resource vertical — MTA Scripts.
2. Delivery: closed code (DRM seller-opt-in) или open source (без DRM).
3. Seller сам задаёт цену.
4. Free/Premium editions нужны.
5. Bundles нужны.
6. Coupons/promo/discounts нужны.
7. Future updates входят в покупку бесплатно.
8. Changelog/version history нужны.
9. Base payout hold = 7 дней, может улучшаться по subscription/verification/trust policy.
10. PSP fee allocation зависит от provider.
11. 10% commission считается от post-discount paid amount.
12. Seller не делает unilateral refund.
13. Seller analytics нужна.
14. Claimed server получает широкую свободу оформления.
15. Public server team roster нужен.
16. Recruitment/factions/applications/events нужны.
17. Delegated: server reputation/ranking = multi-signal hybrid, not stars-only.
18. Server promotion availability зависит от subscription/tariff.
19. Organization универсальна.
20. User может быть в нескольких organizations.
21. Invites, granular permissions, ownership transfer, billing owner, audit нужны.
22. Profile privacy настраивает пользователь.
23. DMs нужны к первой commercial version.
24. Groups/clans отдельно от server/org нужны.
25. Forum supports Markdown/code/files/embeds/polls/reactions/mentions/bookmarks.
26. Events/contests создают только eligible actors.
27. Achievements/levels/seasonal awards нужны и не покупаются как trust.
28. Server discovery = ranking + filters.
29. Marketplace ranking uses all proposed signals.
30. Delegated: sponsored in fixed clearly labeled slots; no organic-rank purchase.
31. Recommendations нужны.
32. Delegated: full personalization opt-out нужен.
33. SCAM/BLACKLIST бессрочен до пересмотра.
34. Transparency page нужна.
35. Seller/Publishing Agreement нужен before first sale.
36. Separate product age policy не нужна; legal/provider constraints still apply.
37. Services/custom development нужны in commercial target.
38. Deal/Guarantee нужны.
39. Daily home/feed = mix content/servers/market/community/notifications.
40. Success measured by combined ecosystem metrics.

---

# Round 5 — lifecycle, UX и launch rules

### R5-01
Нужна ли корзина с несколькими товарами или marketplace может начинать с `Buy now` по одному product/SKU?

### R5-02
Можно ли один commercial resource лицензировать одновременно на несколько серверов через quantity (`1 / 3 / 5 / unlimited`) или сначала только single-server license?

### R5-03
Если продавец снял продукт с продажи, существующие покупатели продолжают скачивать последнюю купленную версию и пользоваться лицензией?

### R5-04
Если seller account заблокирован за нарушение, что делать с добросовестно купленными продуктами: сохранять покупателям download/license, кроме malware/legal takedown?

### R5-05
Нужна ли обязательная demo/trial система для paid scripts или это seller-opt-in?

### R5-06
Нужен ли `Wishlist` для ресурсов и уведомление о скидке/update?

### R5-07
Нужен ли seller support thread/ticket для каждого purchase/product или достаточно DM + public discussion?

### R5-08
Можно ли seller ограничить support сроком, например 30/90/365 дней, если сам продукт и updates остаются доступны?

### R5-09
Какие валюты показывать пользователю: локальную approximate price + settlement currency, либо строго currency товара?

### R5-10
Нужно ли NEXUS автоматически добавлять VAT/tax там, где provider это поддерживает, вместо seller manual logic?

### R5-11
Нужен ли отдельный `Seller balance` UI как отображение provider settlement, даже если деньги фактически хранятся у PSP, а не на NEXUS?

### R5-12
Нужны ли invoice/receipt documents в purchase history там, где provider/legal regime поддерживает их?

### R5-13
Server claim: достаточно proof через текущий MTA server challenge или добавить альтернативы DNS/website/file proof?

### R5-14
Может ли один server иметь нескольких co-owners или только одного owner + organization/team permissions?

### R5-15
Можно ли передавать claimed server другому user/org через ownership transfer с подтверждением обеих сторон?

### R5-16
Нужны ли server status incidents / maintenance posts / scheduled events прямо на странице сервера?

### R5-17
Нужна ли функция `Join server` с deep-link/copy endpoint и отслеживать ли click count как analytics?

### R5-18
Нужно ли показывать live player names, если MTA directory/API это позволяет, или сохранять минималистичную privacy-модель без player identities?

### R5-19
В Organization нужен общий кошелёк/billing profile для purchases/subscriptions или лучше billing owner платит от своего account?

### R5-20
Может ли Organization владеть коммерческим продуктом и получать seller payouts как entity?

### R5-21
DM: разрешать переписку от любого пользователя или default `friends/followed/transaction-related`, чтобы уменьшить spam?

### R5-22
Нужен ли полноценный blocklist пользователя, который блокирует DM, mentions, comments/replies и visibility в рекомендациях?

### R5-23
Нужны ли private groups/community spaces по invite?

### R5-24
Нужны ли voice/video calls внутри NEXUS? Моя рекомендация — нет, использовать Discord/Telegram integrations.

### R5-25
Главная страница гостя и авторизованного пользователя должна сильно отличаться или сохранять общий layout с personalized modules?

### R5-26
Нужен ли onboarding wizard после регистрации: interests, favorite servers, role/capabilities, language, notification preferences?

### R5-27
Нужно ли позволить пользователю скрывать отдельные content categories/authors/servers из рекомендаций (`Not interested`)?

### R5-28
Нужен ли global command palette (`Ctrl/Cmd+K`) как постоянная навигация по search/actions?

### R5-29
Какой production launch выбрать: open beta для всех или staged invites/creator/server onboarding?

### R5-30
Перед реальными платежами требуем отдельный checklist: company/legal/provider agreements, refund policy, ToS/Privacy, tax/accounting, backups, security review, incident response — подтверждаешь?

# Round 5 — ответы владельца (закрыто 2026-10-06)

1. Cart required.
2. One license = one server.
3. Delisted product download/access window: 30 days, not permanent redownload.
4. Seller-ban buyer access: 30 days, subject to malware/legal override.
5. Trial/demo required as platform capability.
6. Wishlist required.
7. Unified NEXUS support system.
8. Seller can configure support duration.
9. Show approximate local currency + authoritative settlement currency.
10. Tax/VAT use provider/MoR where possible.
11. Seller balance/settlement UI required.
12. Receipts/invoices required where supported.
13. Keep current MTA challenge claim method.
14. Multiple server co-owners allowed.
15. Audited ownership transfer required.
16. Maintenance/incident/restart/event status posts required.
17. Join Server CTA + click analytics required.
18. Keep player privacy: aggregate online, no live names by default.
19. Organization has its own billing profile.
20. Organization can own commercial resources and receive payouts.
21. Delegated exact DM default -> Message Requests for strangers, contextual direct communication.
22. Full block primitive required.
23. Private invite-only groups/spaces required.
24. Native voice/video calls rejected.
25. Guest/auth Home share one structure.
26. Registration onboarding required.
27. Per-item `Not interested` controls not required.
28. Command palette/commands rejected as target UX.
29. First public launch target: Open Beta for everyone.
30. Full production gate required before real payments.

---

## Как отвечать

Не обязательно писать длинно. Если точного решения нет, допустимы ответы:

- `да`;
- `нет`;
- `скорее да`;
- `не решил`;
- `предложи варианты`;
- свободный комментарий.

После ответов Decision Register и остальные файлы должны быть обновлены.

---

# A. Идентичность и замысел

### Q01

Как ты сам в одном предложении объяснишь человеку, что такое **MTA NEXUS**?

### Q02

Что должно быть первой ассоциацией с NEXUS:

- лучший каталог MTA-серверов;
- безопасные ресурсы;
- единая MTA-платформа/сообщество;
- marketplace;
- инструменты для владельцев серверов;
- что-то другое?

### Q03

Кто **главный пользователь** первой публичной версии:

- обычный игрок;
- владелец сервера;
- разработчик ресурсов;
- все три равноправно?

### Q04

Сохраняем ли позиционирование **player-first**, или хочешь вернуть старый акцент, где центральная сущность — SERVER и вокруг него строится экосистема?

### Q05

Название **MTA NEXUS** окончательное? Нужен ли подзаголовок/слоган?

### Q06

Какой главный недостаток сегодняшней MTA-экосистемы NEXUS должен исправить лучше всех?

### Q07

Какие 3 вещи пользователь обязательно должен запомнить после первого посещения сайта?

### Q08

Что для тебя будет означать: «проект получился» через год?

---

# B. Аудитория и запуск

### Q09

Проект рассчитан только на русскоязычное/СНГ сообщество с английским переводом или сразу на международную аудиторию?

### Q10

RU и EN достаточно на первый год или планируются другие языки?

### Q11

Closed beta будет:

- по приглашениям;
- открытая регистрация, но ограниченный функционал;
- whitelist creators/servers;
- иной формат?

### Q12

Каким должен быть критерий выхода из beta?

### Q13

Есть ли примерный домен/production hosting/бюджет на инфраструктуру?

### Q14

Планируется ли официальная компания/ИП/юрлицо для коммерческой части или это пока неизвестно?

---

# C. Серверы

### Q15

Должен ли каталог показывать **все публичные MTA-серверы**, которые видит master list, или только зарегистрированные/claim'ed в NEXUS?

### Q16

Что получает владелец после claim сервера?

Нужны ли:

- описание;
- banner/logo;
- ссылки;
- новости;
- changelog/updates;
- команда/staff;
- screenshots/media;
- rules;
- recruitment;
- analytics?

### Q17

Что из server profile должно быть бесплатным всегда?

### Q18

Хочешь ли платный **Server Pro**? Если да, какие преимущества допустимы?

### Q19

Можно ли продавать boosted/promoted position в каталоге серверов, или ranking должен быть полностью нейтральным?

### Q20

Нужны ли исторические графики online/players/uptime-like activity?

### Q21

Сколько истории хранить бесплатно: 24 часа, 7 дней, 30 дней, всегда?

### Q22

Нужны ли server watchlists и уведомления типа «сервер снова онлайн», «резко вырос онлайн», «обновилось описание/версия»?

### Q23

Нужна ли публичная оценка/отзывы серверов?

### Q24

Если отзывы нужны, должен ли пользователь доказать игру на сервере, прежде чем получить метку Verified Interaction?

### Q25

Нужно ли NEXUS когда-нибудь ставить свой модуль/ресурс на server для расширенной интеграции, или принципиально желательно работать без обязательного агента?

---

# D. Ресурсы, разработчики и продавцы

### Q26

Главный ресурсный сценарий первой версии — исключительно **бесплатные ресурсы**?

### Q27

Хочешь ли в будущем разрешить **платные ресурсы** на NEXUS?

### Q28

Любой зарегистрированный developer может публиковать resource после moderation или нужно сначала получить статус/одобрение Seller/Developer?

### Q29

Нужна ли отдельная заявка «Стать продавцом» как в старом MTA Market?

### Q30

Нужна ли публичная creator storefront / developer page как полноценный бренд разработчика?

### Q31

Что обязательно показывать на карточке ресурса для доверия?

Например:

- verified author;
- clean scan;
- SHA-256;
- версия;
- дата проверки;
- MTA compatibility;
- dependencies;
- source/repository;
- changelog;
- downloads;
- rating.

### Q32

Хочешь ли **Resource Inspector**, который автоматически разбирает `meta.xml`, exports, ACL declarations, зависимости и совместимость?

### Q33

Нужна ли интеграция с GitHub: привязка репозитория, import release, changelog, verified repo ownership?

### Q34

Разрешать ли closed-source ресурсы или NEXUS должен поощрять/требовать open source для бесплатных публикаций?

### Q35

Нужны ли dependencies между ресурсами как first-class сущность с предупреждением о несовместимости?

### Q36

Как относиться к внешним download links? Разрешать их или только файлы, прошедшие NEXUS pipeline?

### Q37

Нужны ли пользовательские reviews на бесплатные ресурсы после claim/download?

### Q38

Нужно ли показывать публичный download/claim count или это может стимулировать fake popularity?

---

# E. Коммерция

### Q39

Нужно ли вообще превращать NEXUS в marketplace с реальными деньгами?

### Q40

Если да, какой главный принцип ближе:

- комиссия только с успешной продажи;
- ежемесячная подписка продавца;
- комбинация;
- listing fee;
- другой вариант?

### Q41

Старая модель MTA Market использовала **10% комиссии от финальной цены**. Оставить 10%, сделать меньше/больше или решить позже?

### Q42

В какой валюте должна работать первая коммерческая версия: RUB, EUR, USD, несколько валют?

### Q43

Какие способы оплаты реально нужны в начале?

### Q44

Кто должен получать платёж юридически: сама платформа с последующей выплатой seller или прямой split/marketplace provider?

### Q45

Нужно ли пользователю внутреннее денежное **баланс-счёт** или лучше избегать stored value и работать напрямую через платежи?

### Q46

Нужны ли refunds? В каких случаях?

### Q47

Нужны ли disputes по обычной покупке ресурса?

### Q48

Нужна ли система **услуг**: настройка сервера, дизайн, custom development и т.п.?

### Q49

Нужен ли **Guarantee/Deal/Escrow-like** механизм для P2P услуг, когда деньги выдаются после подтверждения результата?

### Q50

Планируются ли seller payouts автоматически или сначала вручную/через provider marketplace tooling?

### Q51

Нужен ли минимальный срок удержания средств перед выплатой seller для refunds/chargebacks?

---

# F. Подписки и платные преимущества

### Q52

Должна ли существовать платная подписка вообще?

### Q53

Если да, кто платит:

- обычный пользователь;
- developer/seller;
- server owner;
- организация;
- несколько типов?

### Q54

Какие функции **никогда нельзя** делать платными?

Предлагаемый baseline: безопасность, verification truth, доступ к своим claims/purchases, обязательные moderation/security controls.

### Q55

Нужен ли **Creator Pro**? Что он должен давать?

### Q56

Нужен ли **Server Pro**? Что он должен давать?

### Q57

Допустимы ли promoted resources/servers как реклама, если они явно маркируются и не влияют на trust/organic ranking?

### Q58

Нужны ли платные API/webhooks/analytics для профессиональных пользователей?

---

# G. DRM и защита коммерческих ресурсов

### Q59

Нужен ли DRM вообще, если появятся платные ресурсы?

### Q60

Что важнее:

- простота для покупателя;
- сильнее усложнить пиратство;
- возможность отзыва лицензии;
- server-bound license;
- автоматические updates;
- forensic watermark?

### Q61

Допустим ли NEXUS Manager/module на сервере покупателя для лицензий/обновлений?

### Q62

Нужен ли offline grace period, чтобы купленный resource не падал при временной недоступности NEXUS?

### Q63

Нужна ли anti-leak/forensic система или это слишком агрессивно/сложно для первой коммерческой версии?

---

# H. Trust, verification и moderation

### Q64

Какие официальные verification badges нужны?

Например:

- Verified Server;
- Verified Developer;
- Verified Organization;
- Verified Seller.

### Q65

Что должен доказать developer для verification?

### Q66

Должна ли verification быть бесплатной всегда?

### Q67

Какие нарушения ведут к:

- скрытию контента;
- suspension;
- permanent ban;
- отзыву verification?

### Q68

Нужна ли публичная moderation history у server/resource/developer или только internal audit?

### Q69

Нужен ли blacklist/trust registry? Если да, насколько публичным он должен быть?

### Q70

Нужна ли appeal system для решений модерации?

### Q71

Кто на старте будет moderator/admin: только ты или отдельная команда?

---

# I. Community и content

### Q72

Нужен ли полноценный форум как в legacy MTA Market или достаточно comments/discussions рядом с сущностями?

### Q73

Нужны ли статьи/guides как отдельный важный раздел?

### Q74

Кто может писать статьи: все, verified creators, редакция?

### Q75

Нужна ли editorial moderation перед публикацией статьи?

### Q76

Нужны ли server news и server updates как отдельные типы?

### Q77

Нужна ли персонализированная activity feed или лучше ограничиться notifications + dashboard?

### Q78

Нужны ли личные сообщения между пользователями? Если да, зачем именно?

---

# J. UX, визуальный стиль и бренд

### Q79

Какие сайты/продукты визуально ближе к тому, каким должен быть NEXUS?

### Q80

Стиль должен быть:

- минималистичный;
- игровой/атмосферный;
- cyber/tech;
- clean marketplace;
- community portal;
- другое?

### Q81

Насколько сильно server owners и creators могут кастомизировать свои страницы?

### Q82

Нужна ли dark theme как основная? Нужна ли light theme?

### Q83

Какие три пользовательских действия должны быть доступны максимум за 1–2 клика с Home?

### Q84

Нужен ли отдельный onboarding для нового пользователя с выбором интересов/роли?

### Q85

Нужен ли PWA/mobile-app-like режим позже?

---

# K. Privacy и данные

### Q86

Какую пользовательскую аналитику допустимо собирать?

### Q87

Допустимо ли хранить IP для security/rate-limit/audit, и какой retention желателен?

### Q88

Нужно ли позволять пользователю скрывать часть profile activity?

### Q89

Какие данные server owner никогда не хочет видеть публично?

### Q90

Нужны ли privacy/export/delete-account функции уже к public launch?

---

# L. Операции и бизнес-владелец

### Q91

Кто будет фактически обслуживать production и incidents?

### Q92

Какой допустимый ежемесячный infrastructure budget на раннем этапе?

### Q93

Нужна ли высокая доступность 24/7 с самого старта или допустим single-node beta с понятными maintenance windows?

### Q94

Нужны ли публичная status page и incident history?

### Q95

Какие backups/retention ты считаешь достаточными?

---

# M. Метрики

### Q96

Что важнее в первые месяцы:

- число пользователей;
- число active servers;
- число creators/resources;
- downloads;
- weekly returning users;
- community activity?

### Q97

Согласен ли ты с North Star типа **Weekly Meaningful Participants**, а не просто page views?

### Q98

Какие метрики можно показывать публично?

### Q99

Какие метрики нужны только тебе/admin?

---

# N. AI-разработка

### Q100

Какую свободу дать следующему AI-агенту:

- исправлять баги без согласования;
- рефакторить;
- добавлять небольшие UX-фичи;
- менять архитектуру;
- добавлять dependencies;
- делать migrations;
- коммитить в main;
- пушить в GitHub;
- менять CI?

### Q101

Какие действия AI всегда должен согласовать отдельно?

### Q102

Хочешь ли, чтобы AI сам выбирал следующий task из roadmap/problems, когда предыдущий закончен?

### Q103

Должен ли AI оптимизировать количество tests/CI time, если сохраняется достаточная уверенность?

### Q104

Какой стиль commits предпочитаешь: крупные законченные slices или маленькие атомарные commits?

---

# O. Финальное определение продукта

### Q105

Заполни фразу:

> MTA NEXUS существует, чтобы ____________.

### Q106

Заполни фразу:

> Мы никогда не должны превращать NEXUS в ____________.

### Q107

Заполни фразу:

> Пользователь доверяет NEXUS потому, что ____________.

### Q108

Заполни фразу:

> NEXUS зарабатывает деньги, когда ____________.

### Q109

Заполни фразу:

> Главная уникальность NEXUS — ____________.

### Q110

Если придётся оставить только **5 функций**, какие это функции?



# P. Interview Round 3 — Admin, moderation, pricing, reputation, UX

### R3-Q01
Нужна ли одна большая `/admin` с dashboard/очередями или отдельные разделы `/admin/resources`, `/admin/users`, `/admin/servers`, `/admin/payments`, `/admin/disputes`, `/admin/content`, `/admin/security`?

### R3-Q02
Нужны ли отдельные staff roles: Support, Content Moderator, Resource Moderator, Trust/Verification Moderator, Finance/Dispute Manager, Super Admin — или достаточно Moderator/Admin?

### R3-Q03
Какая лестница санкций нужна: warning → content removal → temporary restriction → selling freeze → suspension → permanent ban? Нужны ли capability-specific ограничения вместо полного бана?

### R3-Q04
Нужна ли полноценная appeal system на moderation/verification/dispute decisions?

### R3-Q05
Показывать ли публично причины удаления/снятия verification или публике только короткий status, а детали owner+staff?

### R3-Q06
Нужна ли единая reputation score или лучше независимые показатели: sales, verified orders, ratings, server interactions, account age, violations, response time?

### R3-Q07
Reviews: paid product — только verified purchaser? free product — только claim/download user? Можно ли обновлять review после новой версии?

### R3-Q08
Что нужно для Verified Seller/Developer: N успешных заказов, возраст аккаунта, отсутствие нарушений, GitHub/portfolio, ручная проверка работ, внешние references?

### R3-Q09
Subscriptions: отдельные Creator Pro и Server Pro или единая NEXUS Pro? Нужны tiers `Free / Pro / Business`?

### R3-Q10
Pricing philosophy: дешёвая массовая, профессиональная средняя или B2B высокая? Monthly/yearly/lifetime?

### R3-Q11
Какие one-time функции особенно нужны: boost 24/72h, featured slot, extra storage, custom theme, analytics export, extra team seats, automation credits?

### R3-Q12
Promotion pricing: fixed price/time или auction/bidding? Сколько sponsored slots допустимо на странице?

### R3-Q13
Что на первом экране Home: live servers, personalized activity, global search, featured resources/content или смесь?

### R3-Q14
Должен ли global search одновременно искать servers/resources/users/orgs/articles/forum topics? Нужна ли command palette?

### R3-Q15
Profile customization: avatar/banner/bio/socials/showcase/badges/portfolio/server/resource widgets/themes? Что оставить Pro?

### R3-Q16
DMs нужны до paid launch или позже? Нужны attachments, block/mute, spam controls, report conversation?

### R3-Q17
Forum structure: только platform categories или organizations/server owners/users могут создавать собственные spaces/subforums?

### R3-Q18
Какие content types обязательно pre-moderate: featured articles, ads, first posts, server news, devlogs, forum topics?

### R3-Q19
Нужны web push/email/Telegram/Discord integrations кроме in-app notifications? Какие security/commerce события обязательны?

### R3-Q20
Нужны anti-abuse limits для новых аккаунтов: DM/topic/product/review rate limits и progressive trust?

### R3-Q21
Нужны age restrictions для sellers/buyers и отдельные seller/commercial terms перед первой продажей?

### R3-Q22
Refund digital resource: допускается ли после download/activation? Какие исключения: broken, not-as-described, duplicate, fraud?

### R3-Q23
Кто финально решает dispute: NEXUS staff, PSP или комбинация по типу спора/chargeback?

### R3-Q24
Сколько переносов server-bound license: без лимита, N раз/месяц, cooldown, support?

### R3-Q25
После 7 дней DRM grace: hard stop, limited mode или warning period?

### R3-Q26
Какие данные DRM module имеет право отправлять: server ID, license ID, resource version, heartbeat, IP, hardware fingerprint? Что принципиально не собирать?

### R3-Q27
Разрешаем одновременно open-source и closed-source products? Можно ли продавать исходники отдельно от protected package?

### R3-Q28
Если detail не зафиксирован handbook, AI может выбрать reversible safe вариант и записать `PROVISIONAL`, или должен оставлять `OPEN` до твоего ответа?


# Owner Review Round 3 — ANSWERED 2026-10-06

Confirmed decisions are normalized into `13-DECISION-REGISTER.md` and chapters 20–22. The original Round 3 questions are retained above as interview history.

# Owner Review Round 4 — business rules, entity lifecycle and page structure

These questions should be answered next. Their purpose is to remove ambiguity from implementation rather than reopen already confirmed strategy.

## A. Marketplace / products

1. Какие основные product types должны продаваться в первом коммерческом релизе: scripts/resources, maps, models/assets, web panels, modules/plugins, full gamemodes, services, другое?
2. Может ли один product иметь несколько SKU одновременно: binary, source code, DRM/non-DRM, single-server, multi-server, lifetime updates, limited updates?
3. Цена задаётся продавцом полностью свободно или NEXUS должен иметь minimum/maximum/recommended range?
4. Нужна ли возможность бесплатного продукта с платными premium editions/add-ons?
5. Нужны ли bundles: несколько ресурсов одной покупкой?
6. Нужны seller coupons/promo codes/sales, а также platform-wide promo campaigns?
7. Как работать с версиями: покупатель всегда получает все будущие updates или seller может продавать major upgrade отдельно?
8. Нужна ли публичная changelog/version history у каждого продукта обязательной?

## B. Seller economy

9. Нужен ли payout hold/reserve после продажи, например 7–14 дней, чтобы успеть обработать fraud/refund/dispute?
10. Кто оплачивает PSP fee: seller, NEXUS, buyer или configurable per provider/market?
11. 10% комиссия считается от фактически оплаченной цены после скидки? Налоги/PSP fee входят в базу комиссии или считаются отдельно?
12. Разрешаем seller самостоятельно делать refund без открытия dispute?
13. Нужны ли seller analytics: revenue, conversion, views, refunds, geography, versions, support load?

## C. Servers

14. После claim server page можно полностью настраивать owner-ом в пределах шаблона или только отдельные секции?
15. Нужны server teams/staff profiles с ролями Owner/Admin/Developer/Moderator/Support и публичным отображением?
16. Нужны server events, recruitment/vacancies, clans/factions/teams и applications прямо на NEXUS?
17. Нужен ли rating/review серверов или лучше follows/activity/verified interaction без одной звёздочной оценки?
18. Нужны ли платные placement packages отдельно от Server Pro?

## D. Organizations / identity

19. Organization — это команда разработчиков/студия, администрация сервера или универсальная сущность для обоих случаев?
20. Может ли один user состоять в нескольких organizations?
21. Нужны invitations, granular permissions, ownership transfer, billing owner и audit log организации?
22. Должен ли публичный профиль показывать всю activity по умолчанию или пользователь сам выбирает public/private sections?

## E. Community

23. Нужны ли личные сообщения уже к коммерческому релизу или это post-launch?
24. Нужны ли группы/кланы помимо server/org community spaces?
25. Нужны голосования/polls, attachments, embeds, code snippets, markdown, reactions и reputation awards на форуме?
26. Кто может создавать events/contests: все, verified users, server/org owners, staff?
27. Нужен ли community reward system: achievements, badges, levels, seasonal awards — без превращения в pay-to-win?

## F. Search / discovery / ranking

28. Ranking серверов должен опираться на online/activity/follows/quality/trust или пользователь выбирает сортировку без «секретного топа»?
29. Ranking marketplace: relevance/sales/rating/freshness/updates/trust — какие факторы важнее?
30. Sponsored всегда отдельный визуальный блок или можно смешивать в выдачу при явной метке `Sponsored`?
31. Нужны персональные recommendations на основе follows/views/purchases, с возможностью отключить personalization?

## G. Admin / legal / policy

32. Для blacklist/SCAM нужен expiry/re-review или статус может быть бессрочным до успешной апелляции?
33. Нужна ли публичная страница Transparency / moderation statistics?
34. Нужен ли отдельный seller agreement / resource publishing agreement, который seller принимает при первой публикации/продаже?
35. Какой минимальный возраст/age policy планируется для покупок/продаж, если вообще нужен?
36. Можно ли продавать услуги/custom work через NEXUS в первой коммерческой версии или оставить services/deals на следующий этап?

## H. Product philosophy

37. Что пользователь должен считать «главной причиной открыть NEXUS каждый день»: новости/лента, серверы, community, market, notifications или персонализированная смесь?
38. Что для тебя будет признаком, что проект уже можно назвать успешным через год: users, active servers, GMV, sellers, time spent, community activity или комбинация?
39. Хочешь ли ты, чтобы NEXUS со временем имел публичный API и developer platform для сторонних ботов/сайтов/инструментов?40. Должны ли Telegram/Discord bots стать официальными клиентами NEXUS: notifications, server status, purchases/license status, moderation alerts?


---

# Round 6 — точная структура страниц и dashboards

### R6-01
После login пользователь должен попадать на обычную Home или в персональный Dashboard/Workspace?

### R6-02
Нужен ли единый `/workspace`, который адаптируется к возможностям пользователя (resources, servers, orgs, purchases, support), или отдельные dashboards по ролям?

### R6-03
Для Seller workspace какие блоки обязательны на первой странице: revenue, pending payouts, sales, conversion, product health, reviews, disputes, support, promotions, subscription status — использовать все?

### R6-04
Для Server Owner dashboard какие блоки обязательны: live status, online history, incidents, claims/ownership, team, applications, content/events, reviews, promotion, analytics — использовать все?

### R6-05
Organization dashboard должен объединять members/permissions, servers, resources, billing/payout, subscriptions, audit, support/deals в одном workspace?

### R6-06
Buyer library: показывать Purchased / Free Claims / Trials / Licenses / Updates / Support / Invoices как отдельные tabs?

### R6-07
У каждой покупки нужна отдельная page с order item, seller, version, license/server binding, downloads, updates, support, invoice и dispute actions?

### R6-08
Marketplace product page: какие блоки обязательны above-the-fold — title/price/rating/seller/version/compatibility/DRM/open-source/buy/add-to-cart/trial? Можно ли считать всё это обязательным?

### R6-09
Нужен ли отдельный визуальный badge `Open Source` / `Closed Source` / `DRM Protected` прямо в карточке каталога?

### R6-10
Product screenshots/video/demo server/interactive preview: разрешаем seller media gallery и video embeds?

### R6-11
Compatibility: должны ли seller указывать MTA version, server OS, dependencies и tested versions как обязательные поля?

### R6-12
Нужен ли dependency graph: ресурс A требует resource B/library C, с предупреждением до покупки/установки?

### R6-13
Нужна ли автоматическая compatibility warning, если buyer привязал license к серверу с известными несовместимыми параметрами?

### R6-14
30-дневное правило: после delist seller должен иметь возможность выпустить security hotfix в течение transition window или product полностью frozen?

### R6-15
Ключевой OPEN: после окончания 30 дней у delisted/banned seller уже активная DRM-лицензия должна продолжать работать навсегда, продолжать работать до обычного срока лицензии или выключиться?

### R6-16
Free resource после delist тоже хранить 30 дней для старых claimers или бесплатные безопасные builds можно сохранять дольше?

### R6-17
Support system: нужен ли SLA/priority по подписке seller, например faster routing для Pro, но без влияния на справедливость disputes?

### R6-18
Support tickets могут создавать только buyer/claimer или любой пользователь по pre-sale вопросу тоже?

### R6-19
Нужно ли публично показывать seller response time / support satisfaction как reputation signal?

### R6-20
Home feed: разрешаем infinite scroll или лучше конечные секции + `See more`, чтобы Home не превращалась в бесконечную соцсеть?

### R6-21
Forum/community feed: infinite scroll допустим отдельно от Home?

### R6-22
Нужна ли отдельная `/discover` страница, где смешаны servers/resources/content/people/events, или Global Search + Home достаточно?

### R6-23
Профиль пользователя по умолчанию публичный или минимально закрытый до настройки?

### R6-24
Нужен ли username change и, если да, cooldown/history, чтобы scammer не мог скрывать прошлую identity?

### R6-25
Нужны ли verified links для Discord/GitHub/website, чтобы profile мог доказать владение внешним аккаунтом/доменом?

### R6-26
В админке нужен единый global case search по user/server/resource/order/payment/license/IP/audit ID?

### R6-27
Finance staff должен видеть raw provider payloads или только normalized events + restricted debug access?

### R6-28
Модераторы должны иметь возможность временно `quarantine` resource/build без удаления, мгновенно прекращая новые downloads/activations?

### R6-29
При malware detection нужно автоматически уведомлять всех, кто скачивал affected build, с инструкцией по удалению/обновлению?

### R6-30
Нужна отдельная Security Center для пользователя: sessions, devices, login history, 2FA, recovery codes, API tokens, security alerts?

### R6-31
2FA обязательна для sellers/server owners/org finance/staff или только настоятельно рекомендуется?

### R6-32
Нужны API keys/webhooks для Creator/Server/Organization Pro уже в коммерческой версии?

### R6-33
Public API: разрешаем read-only servers/resources/content API для сообщества или сначала только authenticated partner API?

### R6-34
Нужна система status page (`status.mta...`) и публичная incident history самой платформы?

### R6-35
Какие top-level пункты навигации ты хочешь оставить постоянными на desktop/mobile: Home, Servers, Market, Community, Messages, Notifications, Profile/Workspace — подходит такой набор?

# Round 6 — ответы владельца (закрыто 2026-10-06)

1. После login остаёмся на обычной Home.
2. Единый адаптивный Workspace.
3. Seller dashboard: весь предложенный professional набор.
4. Server Owner dashboard: весь предложенный management/analytics набор.
5. Organization dashboard: весь предложенный набор.
6. Buyer Library: Purchased / Free / Trials / Licenses / Updates / Support / Invoices.
7. Per-purchase detail page нужна.
8. Product page использует предложенный above-the-fold commercial/trust набор.
9. Source/DRM badges в каталоге нужны.
10. Rich media/video/demo links разрешены.
11. Полная compatibility metadata не обязательна.
12. Dependency graph нужен.
13. Automatic compatibility inference/warnings по серверу не нужны.
14. После delist обычные hotfix/releases не выпускаются.
15. Уже активная DRM-license после 30-day hosting window работает до конца своего оплаченного договорного срока.
16. Safe free builds не обязаны удаляться через 30 дней.
17. Subscription support priority допустим, но не влияет на moderation/dispute fairness.
18. Pre-sale support вопрос может создать любой пользователь; также допустима связь с seller.
19. Public seller response-time/satisfaction signal не нужен.
20. Home: конечные секции + `Показать больше`.
21. Community Feed: infinite scroll допустим.
22. `/discover` нужен.
23. Public profile открыт по умолчанию на безопасных полях.
24. Primary identity = ID; subscription может дать username. Изменяемый historical username не нужен.
25. Verified external links нужны.
26. Admin global case search нужен.
27. Raw PSP payload — отдельный restricted access.
28. Quarantine нужна.
29. Affected downloaders при malware нужно уведомлять.
30. Security Center нужен.
31. 2FA не обязательна только из-за роли.
32. API keys/webhooks не нужны как обязательная часть первой commercial release.
33. External API при появлении — только authenticated partners/Pro на первом этапе; не anonymous public API.
34. Отдельная public Status Page не нужна.
35. Top-level navigation оставляем: Home / Servers / Market / Community / Messages / Notifications / Workspace/Profile; Discover должен быть явно доступен.

---

# Round 7 — точная спецификация экранов, аккаунта и operational workflows

Отвечать можно коротко: `1. да`, `2. нет`, `3. предложи сам`.

## A. Guest / Account / Identity

### R7-01
Гость без аккаунта может свободно просматривать public servers, resources, profiles, organizations, articles/forum и Discover, а login нужен только для действий?

### R7-02
Какие действия обязательно требуют подтверждённого email: комментарий/форум, follow, free claim, trial, purchase, публикация resource, server claim, DM — сделать verification обязательной для всего кроме чтения/login?

### R7-03
Добавлять OAuth login через Discord/Google и другие providers или оставить email/password основой, а внешние аккаунты использовать только как verified links?

### R7-04
Нужен ли пользователю `Export my data` / downloadable account archive?

### R7-05
При удалении аккаунта пользователь должен сначала передать/закрыть owned Servers, Organizations, commercial Resources, Deals и финансовые обязательства, после чего personal data удаляется/анонимизируется по retention policy — подходит?

### R7-06
Что делать с vanity username после окончания подписки: оставить за пользователем, но убрать публичное использование; освободить через grace period; или username остаётся пока account существует?

### R7-07
Если подписчик ещё не выбрал vanity username, разрешить выбрать его один раз; дальнейшая смена — только через support при особой причине?

## B. Buyer / Cart / License UX

### R7-08
Гостю разрешить собирать локальную cart, но перед checkout обязательно login/register и server-side revalidation — подходит?

### R7-09
Server binding для paid license делать **после покупки**, чтобы buyer мог купить ресурс заранее и потом выбрать свой server?

### R7-10
Может ли оплаченная, но ещё не привязанная license храниться без ограничения срока до первой activation?

### R7-11
Trial тоже привязывается к одному server и имеет отдельный short entitlement, чтобы его нельзя было бесконечно переносить?

### R7-12
Нужно ли buyer показывать checksum/signature/build scan info прямо на download screen, чтобы он мог проверить файл вручную?

### R7-13
Support/dispute attachments: разрешаем screenshots, logs, text files и safe archives после malware scan?

## C. Seller / Publishing

### R7-14
Publish wizard зафиксировать как: Basic info → Delivery model → Files/Source → Dependencies → Media → Price/SKU → DRM → Support → Preview → Submit/Auto-publish?

### R7-15
Для paid product seller должен пройти KYC/provider onboarding **перед первой выплатой**, но может подготовить draft/listing раньше — подходит?

### R7-16
Автопубликация по подписке должна работать только если seller/account/product history не имеет active risk flags; staff может временно отозвать auto-publish capability?

### R7-17
После публикации seller может сам временно `Unlist` product, но permanent takedown/archive должен сохранять purchase/audit history — подходит?

### R7-18
Archived/delisted product page оставлять публичной с причиной/статусом и без purchase CTA, вместо 404?

### R7-19
Seller/team collaboration: Organization members с `manage_products` могут редактировать/releases/support, но payout settings только finance/billing roles?

## D. Server Owner

### R7-20
Свобода оформления server page: разрешить reorder готовых blocks, custom banner/colors/media/sections, но **не arbitrary HTML/CSS/JS** — подходит?

### R7-21
Recruitment/application forms владелец server/org может собирать из безопасных predefined field types и custom questions?

### R7-22
Нужны публичные changelog/history server page edits и ownership changes, или audit history только staff/owners?

### R7-23
Join Server analytics показывать владельцу агрегированно: clicks, unique approximate users, source/referrer, campaign — без скрытого cross-site tracking?

## E. Organization / Permissions

### R7-24
Нужны permission templates (`Owner`, `Admin`, `Developer`, `Support`, `Finance`, `Content`) плюс custom granular permissions?

### R7-25
Критические действия Organization — ownership transfer, payout destination, member with finance rights, permanent deletion — требуют re-authentication и audit?

### R7-26
Нужна функция Organization invitation link с expiry/max uses, помимо персональных invites?

## F. Staff / Moderation / Finance

### R7-27
Для публичного `SCAM/BLACKLIST` verdict требовать минимум двух staff approvals или одного senior Trust/Admin достаточно?

### R7-28
Для крупных refunds/manual payout corrections/financial reversals нужен dual-control (второе подтверждение staff), где provider это позволяет?

### R7-29
Moderation case должен иметь единый timeline: report → evidence → actions → user response → appeal → final decision → public reason?

### R7-30
Staff notes делить на `internal`, `shared with affected user`, `public reason`, чтобы случайно не публиковать security/PII evidence?

### R7-31
Нужны staff SLA queues/priority levels (`critical malware`, `payment`, `scam`, `appeal`, `normal content`) и automatic escalation?

## G. Messaging / Notifications / Integrations

### R7-32
Telegram/Discord integrations делать официальными notification clients: alerts, purchase/license status, server incidents, moderation events — без возможности выполнять опасные finance/admin actions из бота?

### R7-33
Security/payment/legal notifications пользователь не может полностью отключить, а marketing/community notifications можно тонко настраивать — подходит?

### R7-34
DM attachments нужны? Если да, ограничить images/text/logs/safe archives с malware scan и запретить executables?

## H. UX / Mobile / Platform

### R7-35
Нужен PWA/installable web app с push/offline shell или обычного responsive web достаточно на первую публичную версию?

### R7-36
Нужны одновременно Light/Dark/System themes или сфокусироваться на одном фирменном theme сначала?

### R7-37
Нужна accessibility target выше текущего baseline — например WCAG 2.2 AA для ключевых commercial/account flows?

### R7-38
На mobile bottom navigation сохранить Home / Servers / Market / Community / More, а Messages/Notifications/Workspace спрятать в `More`/header badges, или сделать другой набор?

## I. Data / retention / audit

### R7-39
Как долго хранить audit/security/payment records: использовать юридически/операционно необходимый срок по типу данных, а не один общий срок — подходит?

### R7-40
Нужен user-facing `Activity & Security Log`, где видны login, password/session changes, purchases, license transfers, ownership transfers и sensitive account changes?

# Round 7 — ответы владельца (закрыто 2026-10-06)

1. Guest может читать все public surfaces; login нужен для действий.
2. Email verification обязательна для практически всех действий кроме чтения/login/recovery.
3. Login остаётся email/password; соцсети — подтверждение внешней identity, не login.
4. Self-service `Export my data` не нужен как product feature.
5. При account deletion owned personal entities автоматически переходят в archive; обязательные records сохраняются по retention policy.
6. Vanity username освобождается после окончания entitlement/subscription.
7. Смена vanity username — отдельная платная операция.
8. Guest cart разрешена, перед checkout нужен account + server-side revalidation.
9. License server binding выполняется после покупки.
10. Unbound paid license должна быть активирована в течение 30 дней.
11. Trial привязывается к одному server и имеет short/limited entitlement.
12. Download screen показывает SHA-256/scan/signature/provenance.
13. Support/dispute attachments разрешены с safety scan/type rules.
14. Publish Wizard принимается в предложенной последовательности.
15. Draft/listing возможен до KYC; KYC обязателен перед first payout/provider-required moment.
16. Auto-publish действует только при clean risk state и может быть revoked staff.
17. Seller может Unlist; archive/takedown сохраняют purchase/audit history.
18. Delisted/Archived product page остаётся публичной с причиной, если legal/security не требует скрыть.
19. `manage_products` не даёт payout/billing rights.
20. Server page использует safe block customization без arbitrary HTML/CSS/JS.
21. Recruitment forms поддерживают safe fields + custom questions.
22. Server page/ownership audit history видна только owners/staff.
23. Join analytics может использовать и невидимую пользователю first-party technical telemetry; privacy/legal disclosure всё равно обязательны.
24. Organization permission templates + granular permissions нужны.
25. Critical org actions требуют re-auth + audit.
26. Invite links с expiry/max uses нужны.
27. Одного senior Trust/Admin достаточно для SCAM/BLACKLIST verdict при evidence/audit/appeal.
28. Обязательный second staff approval для крупных refund/manual payout corrections не нужен.
29. Unified moderation timeline нужен.
30. Staff notes делятся на Internal / Visible to user / Public reason.
31. Priority queues + escalation нужны.
32. Telegram/Discord bots пока не нужны; остановиться на email/in-app/Web Push инфраструктуре.
33. Security/payment/legal notifications нельзя полностью отключить; community/marketing можно настраивать.
34. DM attachments нужны, но только safe types/archives после scan; ordinary executables запрещены.
35. Installable PWA, Web Push и offline shell нужны к публичному release target.
36. Поддерживать темы: Light/Dark/System.
37. WCAG 2.2 AA — target для ключевых flows.
38. Mobile bottom nav: Home / Servers / Market / Community / More.
39. Retention задаётся по типу record/legal purpose, а не одним сроком.
40. User Activity & Security Log нужен.

---

# Round 8 — exact role interfaces и ежедневные workflows

## A. Guest / Home / Discover

### R8-01
На Home у гостя первым экраном делать большой global search + live ecosystem summary, а ниже Servers / Market / Community / Events?

### R8-02
Нужен ли отдельный блок `Trending now` на Home или лучше не вводить единый трендовый рейтинг?

### R8-03
В `/discover` пользователь должен переключать tabs `All / Servers / Resources / People / Organizations / Content / Events` или лучше одна смешанная лента + filters?

### R8-04
Guest CTA на resource/server/community cards должен быть контекстным (`View`, `Join`, `Add to cart`, `Sign in to follow`) вместо постоянных register banners — подходит?

## B. User / Profile / Community

### R8-05
В профиле основной набор tabs: `Overview / Activity / Resources / Servers / Organizations / Reviews / Achievements`?

### R8-06
Показывать public activity timeline пользователя по умолчанию или только явно выбранные/showcase события?

### R8-07
Нужен отдельный Reputation/Trust page у пользователя, где видно verified signals, completed sales/deals, badges и public sanctions/history?

### R8-08
Community navigation: `Feed / Forum / Articles / Events / Groups` — подходит?

### R8-09
Forum hierarchy строить глобально как Categories -> Boards -> Topics, а server/org spaces подключать как отдельные managed hubs?

## C. Buyer

### R8-10
Buyer Workspace landing должен показывать прежде всего recent purchases, pending activation licenses, available updates, support/dispute alerts и wishlist changes?

### R8-11
Purchase detail page: один вертикальный timeline или tabs `Overview / Downloads / License / Updates / Support / Invoice / Dispute`?

### R8-12
За 7/3/1 день до истечения 30-day activation window присылать reminders?

### R8-13
При добавлении paid script в cart разрешить сразу выбрать target server, но не делать это обязательным до оплаты?

## D. Seller / Creator

### R8-14
Seller Dashboard landing: KPI cards (`Revenue / Pending / Sales / Conversion / Refunds`) + `Product health` + action queue (`Moderation / Support / Disputes / Updates`)?

### R8-15
Products table должна показывать `Status / Version / Price / Sales / Rating / Support / DRM / Last update / Risk`?

### R8-16
Publish Wizard сделать полноэкранным отдельным workflow, а не modal/drawer?

### R8-17
Seller Analytics нужны date range, product comparison, acquisition source, funnel `view -> cart -> purchase`, revenue/refund/download/update metrics?

### R8-18
Нужен отдельный Promotions manager для boosts/featured slots/campaign history?

### R8-19
Seller Support показывать единый inbox по pre-sale и buyer tickets с привязкой к product/purchase?

## E. Server Owner

### R8-20
Server Dashboard landing: live online/status, 24h/7d graph, Join clicks, follows, reviews/trust, incidents и quick actions?

### R8-21
Server page builder делать visual block editor с preview desktop/mobile?

### R8-22
Incidents/Maintenance/Events объединить в один calendar/timeline или оставить отдельные sections?

### R8-23
Recruitment applications нужна kanban/status pipeline (`New / Reviewing / Interview / Accepted / Rejected`)?

### R8-24
Co-owner/team permissions server-а использовать тот же capability engine, что Organizations, или отдельную упрощённую модель?

## F. Organization

### R8-25
При переключении active Organization весь Workspace должен менять context (resources/servers/billing/support), сохраняя personal context отдельно?

### R8-26
Organization overview: members, owned servers/resources, current subscriptions, revenue/payout status, open support/deals, recent audit?

### R8-27
Finance page Organization отделить визуально и permission-wise от обычных management sections?

### R8-28
Нужен отдельный Organization public storefront/portfolio, объединяющий resources, servers, team, articles и reviews?

## G. Moderator / Support / Finance / Admin

### R8-29
Staff Home делать как role-aware operations dashboard: assigned cases, SLA/escalations, critical incidents, queue counters, recent high-risk actions?

### R8-30
Case detail layout: entity summary слева/сверху, evidence + timeline в центре, actions/reason panel отдельно — подходит?

### R8-31
Перед irreversible sanction/quarantine/refund показывать confirmation screen с impact preview: кого затронет, downloads/licenses/payments/notifications?

### R8-32
Support agent может видеть buyer purchase/license/product context, но не payment raw payload и internal Trust notes без capability — подтверждаешь?

### R8-33
Finance agent видит orders/payments/refunds/payouts/disputes, но не может менять content/moderation verdict без отдельной роли — подтверждаешь?

### R8-34
Super Admin emergency tools скрыть в отдельный `System` area с обязательным reason/re-auth/audit, а не смешивать с обычной admin navigation?

## H. Subscription / pricing presentation

### R8-35
Нужна одна публичная `/pricing` page, сравнивающая Creator / Server / Organization / NEXUS bundle, плюс contextual upsell внутри Workspace?

### R8-36
Показывать пользователю экономию/комиссию/hold-time advantages тарифов максимально прозрачно до покупки подписки?

### R8-37
Если subscription заканчивается, paid-only automation/promotions останавливаются сразу, а данные/настройки сохраняются для повторной подписки — подходит?

### R8-38
Vanity username после expiry освобождать сразу или дать короткий grace/reservation, например 7 дней?

## I. Release / operational UX

### R8-39
PWA offline shell должен показывать явный `Offline` state и блокировать state-changing CTA вместо optimistic queue для платежей/лицензий/publish?

### R8-40
На production error pages (`404/403/409/429/5xx`) показывать request/correlation ID для support, но не внутренние stack traces — подтверждаешь?

## Round 8 — owner answers (2026-10-06)

1. Да — Home starts with global search + ecosystem state, then Servers/Market/Community/Events.
2. Да — `Trending now` is required.
3. Без смешанных выдач — `/discover` uses entity-specific tabs/sections, not one heterogeneous mixed feed.
4. Да — contextual CTAs instead of persistent registration banners.
5. Да — profile tabs: Overview/Activity/Resources/Servers/Organizations/Reviews/Achievements.
6. Лента — public Activity is a real timeline/feed subject to privacy/visibility rules.
7. Не понял — at Round 8 this remained OPEN. **Superseded by Round 9 answer 9: dedicated public `Trust/Reputation` tab is CONFIRMED.**
8. Да — Community: Feed/Forum/Articles/Events/Groups.
9. Да — global forum hierarchy + managed server/org spaces.
10. Да — Buyer landing prioritizes purchases/licenses/updates/support-disputes/wishlist.
11. Лучше tabs — Purchase detail uses tabs.
12. Да — activation reminders at 7/3/1 days.
13. Да — target server may be selected in Cart, but is not mandatory before payment.
14. Да — seller KPI landing + Product Health/action queue.
15. Да — approved product table columns.
16. Да — Publish Wizard is full-page workflow.
17. Да — seller analytics date/product/source/funnel/revenue-refunds-downloads-updates.
18. Да — dedicated Promotions Manager.
19. Да — unified seller support inbox.
20. Да — approved Server Dashboard summary.
21. Да — visual block editor + desktop/mobile preview.
22. Отдельные — Incidents/Maintenance/Events remain separate management sections.
23. Да — recruitment status pipeline.
24. Тот же — server team uses same capability engine as Organizations.
25. Да — active Organization switches Workspace context.
26. Да — approved Organization overview.
27. Да — separate Organization Finance surface/capabilities.
28. Да — public Organization storefront/portfolio.
29. Да — role-aware Staff Home.
30. Да — case-detail layout with entity/evidence/timeline/actions.
31. Да — impact preview before high-impact actions.
32. Да — Support sees transaction context but not restricted raw payment/Trust notes without capability.
33. Да — Finance cannot moderate content without separate role.
34. Да — Super Admin System area with reason/re-auth/audit.
35. Да — one public `/pricing` + contextual Workspace upsells.
36. Да — commission/hold-time/plan economics are transparent.
37. Да — paid-only automation/promotions stop on expiry; config/data retained.
38. Держать 7 дней — vanity username reservation grace after entitlement expiry.
39. Да — offline PWA blocks state-changing commerce/license/publish actions.
40. Да — production error pages expose correlation/request ID, never stack trace.


# Round 9 — тарифы, moderation matrix, DRM forensic и production business rules

Этот раунд закрывает оставшиеся owner-level решения, которые уже нельзя безопасно выдумывать из UI/архитектуры.

## A. Pricing / plans / hold

### R9-01
Оставляем базовую marketplace-комиссию **10% для всех**, или платные Creator-тарифы могут снижать её (например до 8%/6%)?

### R9-02
Базовый payout hold для нового продавца — 7 дней. Подписка/verification/history могут уменьшать hold вплоть до 1–3 дней — подтверждаешь?

### R9-03
Нужен полностью бесплатный `Creator Free`, где можно публиковать с ручной модерацией, а `Creator Pro` даёт auto-publish/analytics/automation/promotion advantages?

### R9-04
Для пользователя без Creator subscription разрешить разовую платную **ускоренную/автоматизированную публикацию** конкретного ресурса, сохраняя все security gates?

### R9-05
`Server Pro` должен иметь несколько уровней (например Basic/Pro/Business) или один основной paid plan + разовые promotions?

### R9-06
`Organization Pro` должен тарифицироваться по организации целиком или по количеству seats/members?

### R9-07
`NEXUS Pro` bundle должен объединять преимущества Creator + Server + personal customization, но Organization billing оставлять отдельно?

### R9-08
Цена подписки может отличаться по региону/валюте или храним одну базовую цену и только конвертируем display?

## B. Trust / Reputation

### R9-09
Уточнение Round 8 вопроса 7: нужен ли отдельный публичный tab `Trust`, где в одном месте видны Verified badges, возраст/история аккаунта, completed sales/deals, verified reviews и публичные санкции/SCAM status? Это не единый score, а набор доказательств. Да/нет?

### R9-10
Показывать ли точное количество успешных продаж/сделок публично или только диапазоны/статусы, чтобы не раскрывать лишнюю коммерческую статистику?

### R9-11
Показывать ли public moderation history после снятия предупреждения/санкции или только активные и серьёзные historical SCAM/blacklist решения?

## C. Content moderation matrix

### R9-12
Первый forum topic нового аккаунта должен проходить премодерацию, а после нормальной истории — публиковаться сразу?

### R9-13
Любая платная реклама/featured content должна проходить content-policy проверку до показа, даже если оплата уже прошла?

### R9-14
Articles/guides от обычных пользователей: publish immediately + reports или premoderation до достижения trust threshold?

### R9-15
Server news/devlogs владельца claimed server можно публиковать сразу, если account/server без active risk flags?

### R9-16
Events/contests публикуются только verified/server/org/staff actors и всё равно могут попадать в selective moderation — подходит?

### R9-17
Нужен anti-spam trust threshold, после которого снимаются лимиты на DM/topics/comments, но финансовые/security лимиты остаются независимо от reputation?

## D. DRM / license product rules

### R9-18
Продавец может выбирать между **perpetual license** и **time-limited license/subscription** для самого ресурса, или marketplace scripts по умолчанию всегда perpetual purchase?

### R9-19
Для perpetual DRM license после покупки/активации срок работы бесконечный, кроме revoke/malware/legal; 7 дней — только offline lease grace. Подтверждаешь?

### R9-20
Forensic watermark/fingerprint сделать seller-opt-in: NEXUS генерирует индивидуальный невидимый marker/license package без перекомпиляции основного runtime?

### R9-21
При обнаружении leaked copy watermark используется только как evidence для staff/dispute, без автоматического SCAM/ban по одному совпадению?

### R9-22
Seller может видеть только факт подозрительной утечки и case status, но не сырые security signals/алгоритм обнаружения?

### R9-23
Разрешить seller самому revoke license только через формализованный reason flow (refund/fraud/contract violation), а не кнопкой без причины?

## E. Support / SLA

### R9-24
Нужны публично обещанные SLA NEXUS Support по тарифам, например Critical Security быстрее, а обычные вопросы по очереди, или не обещать жёсткие часы до появления команды?

### R9-25
Seller сам задаёт свои support hours/SLA на product page или только срок поддержки (30/90/365 дней), без обещания времени ответа?

### R9-26
Для disputes установить внутренние target-сроки рассмотрения, но не обещать автоматическую победу/возврат после истечения срока?

## F. Production infrastructure / business gates

### R9-27
До выбора реального юрлица/страны/PSP оставить handbook provider-agnostic и считать конкретные payment providers **implementation decision at production gate**?

### R9-28
Хранилище коммерческих файлов должно быть private object storage + CDN signed URLs, а локальное filesystem storage оставить только dev/test fallback?

### R9-29
ClamAV оставить baseline scanner, но архитектура должна позволять подключить дополнительные scanners/reputation services без изменения product workflow?

### R9-30
Production observability должна включать centralized logs, metrics, traces/error tracking, uptime checks, backup monitoring и security alerts; конкретного vendor-а AI может выбрать как PROVISIONAL обратимое решение?


# Round 9 — owner answers

1. Baseline 10% for everyone now; subscription may reduce commission later.
2. Yes — subscription/verification/history may shorten baseline 7-day hold.
3. Yes — Creator Free + paid Creator capability model.
4. Yes — one-off accelerated/automated publication allowed with mandatory security gates.
5. Both — multiple Server tiers and one-off purchases.
6. Organization is billed as a whole entity.
7. NEXUS Pro includes everything/cross-ecosystem benefits; exact entity quotas remain to define.
8. Same base prices globally; local display conversion is allowed.
9. Yes — dedicated public Trust/Reputation tab.
10. Exact successful sale/deal count may be public.
11. Keep all finalized public moderation history, including historical states.
12. Yes — first topic premoderation, healthy history may unlock immediate publishing.
13. Yes — paid advertising requires content-policy review.
14. Owner delegated decision. Chosen policy: trust-tiered premoderation for new/low-trust article authors, post-moderation for healthy established authors.
15. Yes — claimed server news/devlogs may publish immediately without active risk flags.
16. Yes — event/contest creation only by eligible actors with selective moderation.
17. "Ограничивать все" — interpreted as limits remain on all categories; trust may adjust quotas but never makes a category unlimited.
18. Yes — perpetual and time-limited/subscription resource licenses.
19. Yes — perpetual DRM right remains indefinite after activation except formal revoke/malware/legal/security; 7 days is offline lease grace.
20. Yes — seller-opt-in forensic watermark without per-customer runtime recompilation.
21. Yes — leak marker is evidence, not automatic guilt/ban.
22. Yes — seller sees suspicion/case state, not sensitive detection internals.
23. Yes — seller revoke requires formal allowed reason.
24. Yes — do not promise hard public hourly SLA before staffed operations; Critical Security remains top priority.
25. Yes — seller defines support period, not mandatory response-time SLA.
26. Yes — internal dispute targets do not auto-decide outcome.
27. Yes — payment layer stays provider-agnostic until production legal/provider gate.
28. Yes — production commercial artifacts use private object storage + signed CDN URLs; local filesystem dev/test fallback.
29. Yes — ClamAV baseline with pluggable additional scanners/reputation services.
30. Not understood — concrete observability-vendor selection authority remains OPEN and is explained in `55-PRODUCTION-STORAGE-SCANNERS-AND-OBSERVABILITY.md`.


# Round 10 — финальные числа, квоты и repo handoff

Этот раунд не меняет архитектуру продукта. Он нужен, чтобы определить числовые defaults и способ официально положить handbook в основной repository.

## A. Observability

### R10-01
Простыми словами: production observability — это инструменты, которые сообщают, когда сайт падает/тормозит/ошибается, собирают логи и графики, следят за backup и security alerts. Разрешить AI самому выбрать подходящие сервисы/инструменты как обратимое `PROVISIONAL` решение, а потом при необходимости заменить? Да/нет.

## B. Creator economics

### R10-02
Оставить Creator tiers примерно `Free / Pro / Business`, или достаточно `Free / Pro`?

### R10-03
Если подписка снижает комиссию, подходят ориентиры: `Free 10% / Pro 8% / Business 6%`? Это можно потом скорректировать.

### R10-04
Payout hold ориентировочно: `Free/new 7 days / verified or Pro 3 days / highest trusted Business 1 day`, при этом risk/provider rules могут увеличить hold — подходит?

### R10-05
Нужен минимальный порог цены платного script, чтобы микроплатежи не съедались комиссиями PSP, или seller может поставить любую цену выше технического minimum provider-а?

### R10-06
Максимальный размер одного marketplace build на старте: 256 MB / 512 MB / 1 GB / предложить самому?

## C. Server / Organization / NEXUS plans

### R10-07
Server plans: `Free / Pro / Business` — подходит?

### R10-08
Organization plans: `Free / Pro` или `Free / Pro / Business`?

### R10-09
NEXUS Pro должен быть одной максимальной подпиской или тоже иметь уровни?

### R10-10
Если NEXUS Pro включает Organization преимущества, он покрывает одну Organization по выбору пользователя или несколько?

### R10-11
Платные планы могут повышать team/member/storage/media quotas, но никогда не ограничивать базовое владение купленным контентом — подтверждаешь?

## D. Marketplace defaults

### R10-12
Trial продукта по умолчанию seller сам задаёт, но ограничиваем максимум, например 1–7 дней?

### R10-13
Support period при создании товара: seller выбирает `none / 30 / 90 / 365 days / custom`?

### R10-14
После покупки обновления бесплатны навсегда — уже подтверждено. Нужно ли seller разрешать отдельно помечать major version как новый самостоятельный продукт, если это фактически новая разработка, а не update старого SKU?

### R10-15
Refund/dispute request для обычной проблемы ограничивать, например, 14 днями после покупки, кроме malware/fraud/legal/security случаев?

### R10-16
Нужна минимальная сумма вывода продавцу или при provider-managed payouts используем ограничения самого PSP?

## E. Public trust / moderation

### R10-17
В публичной Trust history показывать дату, тип решения, статус, краткую публичную причину и результат appeal — без внутренних доказательств. Подходит?

### R10-18
Expired warning остаётся видимым, но визуально явно слабее active sanction/SCAM — подтверждаешь?

## F. Repository handoff

### R10-19
После твоего финального просмотра переносим handbook в `mta-nexus-site/docs/handbook/` и **меняем текущую repository policy**, которая сейчас ограничивает long-form docs тремя файлами, чтобы handbook стал официальной частью `main`?

### R10-20
После интеграции handbook в repo AI должен считать порядок источников таким: `owner-confirmed Decision Register/handbook → current security/data invariants → current implementation → legacy MTA Market`, а при конфликте implementation с новым target не молча считать старый код продуктовой истиной, а планировать безопасную миграцию. Подтверждаешь?