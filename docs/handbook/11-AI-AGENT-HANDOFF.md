# MTA NEXUS — инструкция для AI-агента, продолжающего разработку

> Статус: обязательный handoff-контекст handbook v0.2; owner review round 1 incorporated.  
> Цель: не дать следующему агенту потерять продуктовый замысел, перепутать legacy с current scope или разрушить уже закреплённые safety-инварианты.

## 1. Миссия агента

Твоя задача — продолжать MTA NEXUS как реальный продукт, а не генерировать максимальное количество кода.

Приоритеты:

1. корректность;
2. безопасность;
3. простота;
4. пользовательская ценность;
5. проверяемость;
6. эксплуатационная готовность;
7. только затем скорость расширения scope.

---

## 2. Репозиторий

Current repository:

```text
acc-holo-dev/mta-nexus-site
```

Development line:

```text
main
```

### DECISION

Не создавать постоянный `dev` branch и не строить workflow вокруг долгоживущих feature branches, если владелец отдельно не меняет эту политику.

---

## 3. Источники истины и их приоритет

При конфликте использовать такой порядок:

```text
1. Current executable code + database migrations
2. Current tests/CI behavior
3. Current repository README/docs/ARCHITECTURE.md/docs/OPERATIONS.md/docs/PROBLEMS.md
4. Owner decisions recorded in this handbook / Decision Register
5. Recent conversation context
6. Legacy MTA-MARKET-PLATFORM documents
7. Ideas/speculation
```

### Legacy warning

`MTA-MARKET-PLATFORM` — богатый источник product ideas, но он содержит старую архитектуру и старую коммерческую модель.

Не переносить его решения механически.

---

## 4. Текущее product boundary

### CURRENT

MTA NEXUS — **единая площадка всего MTA community**. Текущий codebase уже покрывает:

- live server discovery;
- server ownership/profile workflows;
- community/content surfaces;
- follows/notifications;
- safe free-resource distribution;
- creator resource workflow;
- verification/moderation/trust primitives.

### CURRENT CLOSED-BETA CONSTRAINT VS TARGET

Сейчас paid checkout, stored balance, seller payouts, crypto settlement и активный DRM выключены. **Но owner уже подтвердил target:** paid marketplace, 10% commission, subscriptions/one-time monetization и обязательный DRM должны быть построены. Не путай «пока выключено» с «не нужно». Production activation остаётся отдельным gate.

---

## 5. Non-negotiable invariants

Пока владелец явно не поменяет решение, сохранять:

### Product

- RU и EN — first-class;
- один User может иметь несколько ролей/capabilities;
- privacy by default;
- real data only;
- server state из реального observation path, не из ручной fake metadata;
- complexity должна быть скрыта от обычного пользователя.

### Resource safety

Публичный build только если:

```text
status = published
scanStatus = clean
scanner is present
scannedAt is present
```

Claim/download не обходят этот инвариант.

### Authorization

- проверять текущего actor/context;
- historical authorship не даёт вечного доступа;
- organization access — по текущему membership/permissions;
- private responses не становятся public-cacheable.

### Data

- critical multi-write flows transactional;
- concurrency-sensitive paths serialized/unique;
- retries idempotent;
- forward migrations;
- production data не использовать как test fixture.

### UI

- mutation success server-authoritative;
- ошибки не маскировать optimistic UI;
- responsive/mobile;
- keyboard accessibility не ломать.

### Release

- exact SHA;
- actual gates, not assumed gates;
- backup/restore;
- human production authorization.

---

## 6. Первый шаг в новой сессии

Перед изменениями:

1. получить latest `main`;
2. проверить working tree;
3. прочитать current `README.md`;
4. прочитать `docs/PROBLEMS.md`;
5. прочитать relevant часть `docs/ARCHITECTURE.md`/`OPERATIONS.md`;
6. посмотреть latest commits вокруг target area;
7. найти существующие tests для target area;
8. только затем планировать изменение.

Не доверять handbook snapshot, если main ушёл вперёд.

---

## 7. Работа над одной задачей

Предпочтительный цикл:

```text
Observe
-> define concrete defect/value
-> identify invariant/authority/data impact
-> make one coherent implementation
-> run focused tests
-> inspect failures
-> run broader relevant gates
-> inspect exact diff
-> commit to main
-> re-read resulting SHA/status
-> update durable docs only if truth changed
```

---

## 8. Что считается плохой разработкой

Не делать:

- десятки cosmetic commits вместо завершённого slice;
- большие refactor без measurable benefit;
- «зелёные» tests, которые не запускались;
- fake metrics;
- mock production flows под видом feature;
- duplicate authorization logic в UI;
- обход scanner ради удобства dev;
- silent fallback с payment/security semantics;
- optimistic «успешно», если server не подтвердил target/state;
- новый infrastructure stack без необходимости;
- indiscriminate legacy port.

---

## 9. Работа с тестами

### Требование

Тест должен доказывать observable behavior или critical invariant.

Избегать накопления brittle tests, которые проверяют только текст исходника, если можно проверить реальное поведение.

### Strategy

- pure logic -> unit;
- SQL/concurrency -> database integration;
- route contract -> HTTP test;
- critical user journey -> browser;
- production topology -> dedicated release/rehearsal test.

### CI cost

Не дублировать дорогие сборки/полные suites без необходимости. Сохранять текущий optimized CI philosophy.

---

## 10. Работа с БД

Перед schema change:

1. найти current schema/migrations;
2. понять existing rows;
3. определить constraints;
4. оценить migration на populated DB;
5. написать forward migration;
6. добавить integration coverage;
7. описать production impact, если material.

### Forbidden

- редактировать уже применённую shared migration;
- «лечить» production ручным удалением ledger/migration row;
- предполагать, что rollback application автоматически rollback schema.

---

## 11. Работа с ресурсами/artifacts

Любая feature вокруг upload/download должна учитывать:

- bounded body;
- safe filename handling;
- generated immutable storage key;
- scan fail-closed;
- SHA-256/size;
- moderation;
- current published version;
- authorization;
- cancellation;
- private error semantics;
- audit meaning;
- browser memory.

Не добавлять direct public storage URL как shortcuts без security review.

---

## 12. Работа с серверным directory

Помнить:

- external source может быть slow/down/oversized;
- stale snapshot имеет bounded lifetime;
- public live data и owner editorial data не одно и то же;
- server ownership требует proof + platform verification semantics;
- нельзя собирать лишнюю player-level telemetry только ради аналитики.

---

## 13. Работа с trust

Любой trust signal должен отвечать:

1. что именно утверждает знак/метка;
2. какой evidence;
3. кто проверил;
4. когда проверено;
5. может ли быть отозвано;
6. не интерпретирует ли UI знак шире доказанного.

### Example

`Clean scan` означает, что конкретный artifact прошёл конкретный scanner в конкретное время.

Это не означает «код гарантированно безопасен».

---

## 14. Работа с коммерцией

### CONFIRMED TARGET + PRODUCTION GATE

Уже подтверждено:

- paid marketplace нужен;
- базовая platform commission = 10%;
- subscriptions и one-time paid features нужны;
- отдельный mandatory seller application не нужен;
- DRM capability обязательна для платформы, но seller opt-in per product.

AI может самостоятельно разрабатывать эти части по roadmap: schema/domain/UI/tests/migrations/provider abstraction/sandbox flows.

Проверяй Decision Register для ещё OPEN деталей: launch jurisdiction/providers, refund/chargeback specifics, payout reserves/intervals, subscription pricing, DRM transfers/post-grace/privacy и moderation/reputation policy. Не выдумывай irreversible/high-risk детали молча.

Human gate требуется перед включением **реальных production payments/payouts/escrow**, использованием боевых credentials или изменением согласованной 10% financial policy.

---

## 15. Legacy commerce reference

При реализации подтверждённого paid marketplace сохранить полезные legacy principles:

```text
Order != Payment != License
```

OWNER DECISION: базовая ставка NEXUS подтверждена как 10% commission. OPEN остаётся точная база расчёта относительно PSP fee, taxes, discounts и refunds.

Provider architecture должна быть нейтральной и fail-closed: выключенный provider отсутствует/отклоняется, а не подменяется другим тихо.

---

## 16. Работа с UI/UX

Проверять минимум:

- desktop;
- 390px mobile;
- 320px narrow mobile;
- RU;
- EN;
- loading;
- empty;
- error;
- long text;
- keyboard;
- focus restoration;
- overflow.

### Product feel

NEXUS должен ощущаться единым продуктом, а не набором админских таблиц.

Но visual polish не должен скрывать missing backend.

---

## 17. Documentation discipline

Current repository intentionally ограничивал число long-form docs.

Этот handbook — продуктовый handoff layer, который владелец может позже встроить/консолидировать.

Не создавай новый `.md` для каждого маленького решения.

Текущий repository-policy test ограничивает состав long-form docs. Не копируй этот handbook целиком в `docs/` без отдельного owner-approved изменения documentation policy и соответствующего теста.

Если durable truth изменилась:

- update existing relevant document;
- update Decision Register;
- update Problems, если проблема закрыта/появилась.

---

## 18. Problems discipline

`docs/PROBLEMS.md` — current technical problem register.

### Rule

Закрытая проблема удаляется/обновляется вместе с изменением, которое реально её закрыло.

Не объявлять проблему закрытой по намерению.

---

## 19. Performance discipline

Не оптимизировать абстрактно.

Измерять:

- query plan;
- response latency;
- DB row count;
- memory;
- disk read;
- artifact hashing;
- browser memory;
- external source timing.

После измерения выбирать минимальное изменение.

---

## 19.1 Owner-granted AI autonomy

AI-агенту разрешено без промежуточного согласования:

- выбирать следующий task из roadmap/problems;
- исправлять bugs;
- рефакторить и менять внутреннюю архитектуру, если это улучшает продукт;
- добавлять связанные UX/product features;
- добавлять dependencies с нормальной проверкой;
- создавать forward migrations;
- оптимизировать tests/CI без потери доказательности;
- коммитить и пушить coherent finished slices прямо в `main`.

Не интерпретировать это как разрешение на production deploy, destructive data changes или включение реальных платежей без операционного/юридического gate.


### Owner decisions from interview round 2

AI не должен повторно открывать как неопределённые следующие решения:

- directory включает все публичные master-list servers;
- Server Pro может включать analytics/customization/API/webhooks/media/team/automation/promotion;
- promoted servers/resources допустимы при явной маркировке;
- продавать может любой зарегистрированный пользователь; verification — отдельный trust layer;
- auto-publish только subscription capability; automated safety gates обязательны;
- payment layer — multi-provider/multi-method;
- payout design должен минимизировать ручные операции и расходы owner; prefer provider-managed split/settlement where feasible;
- disputes обязательны;
- DRM capability обязательна для платформы, seller opt-in per product;
- protected flow: Purchase → License → Installation/Server → Activation → Lease; offline grace 7 days;
- DRM runtime/module universal, no recompilation per server/customer;
- Community target broad: forum + entity discussions + articles/news/devlogs/updates/feed/notifications/events/contests; DMs required by first commercial version;
- некоторые content categories могут требовать pre-moderation;
- verification cannot be purchased;
- major-pillar implementation order выбирается dependency/risk driven; owner оценивает результат, а не формальный порядок.

## 20. High-risk human gates

Остановиться и запросить решение перед действиями уровня:

- destructive production data operation;
- production deploy / traffic switch;
- необратимая migration с риском потери production data;
- rotation/удаление ключей, способное сделать existing encrypted data нечитаемыми;
- реальные production payments/payouts/escrow и боевые credentials;
- изменение уже согласованной financial/legal модели (включая 10% commission).

Обычные архитектурные, trust, UX, moderation, CI и schema improvements агент может проектировать и реализовывать самостоятельно, если они не создают сопоставимого необратимого production-риска.

---

## 21. Recommended next priorities

Пока Decision Register не изменён:

```text
P1: current release/infra gaps
P2: UI/UX and RU/EN completeness
P3: closed beta release quality
P4: server intelligence
P5: resource intelligence/creator workflow
P6: community/content
P7: paid marketplace foundation + subscription design
P8: license/DRM foundation after stable purchase primitives
```

Не начинать коммерцию с payout/escrow/production credentials. DRM является обязательной целью, но должен опираться на устойчивую license/entitlement модель.

---

## 22. Definition of a good AI update

Хороший update:

- решает несколько связанных проблем в одном coherent slice;
- уменьшает complexity либо добавляет измеримую user value;
- имеет tests;
- не ломает invariants;
- оставляет main clean;
- имеет понятный commit message;
- точно сообщает, что было и не было проверено.

---

## 23. Commit discipline

Перед commit:

- inspect `git diff`;
- убедиться, что нет secrets/generated junk;
- run relevant checks;
- проверить docs impact.

После commit:

- read exact SHA;
- `git status`;
- убедиться, что main содержит ожидаемый commit;
- не заявлять push/sync, если он не произошёл.

---

## 24. AI-agent context packet

Перед крупной задачей агенту полезно дать:

- этот handbook;
- repository access;
- current `docs/PROBLEMS.md`;
- exact objective;
- allowed/destructive boundaries;
- whether GitHub push is authorized;
- whether production access is authorized.

---

## 25. Handoff completion criteria

Handoff считается успешным, если новый агент после чтения способен правильно ответить:

- что такое MTA NEXUS;
- для кого он;
- что уже работает;
- почему paid commerce сейчас отключена;
- как публикуется safe resource;
- как устроена server ownership verification;
- кто что может делать;
- где источник истины;
- какие release gates нужны;
- какие product decisions ещё открыты;
- что нельзя решать автоматически.



## 29. Owner review Round 3 — mandatory context

The owner has additionally confirmed:

- admin is split into specialized operational departments;
- staff capabilities are cumulative; a staff member can hold several roles;
- sanctions are capability-scoped and can include platform-decided `SCAM`/`BLACKLIST` labels;
- public moderation/enforcement should expose the substantive reason, subject only to necessary security/privacy/legal redaction;
- appeals are first-class for moderation/sanctions/verification/eligible disputes;
- reputation is multi-signal, not purchasable;
- reviews require real purchase/claim eligibility and may be updated after later versions;
- specialized pillar subscriptions and an umbrella NEXUS bundle may coexist;
- subscription terms can be configured approximately from 7 days to 1 year;
- one-time monetization focuses fixed-price advertising/promotion and selected publishing/operational services;
- server/org owners may create their own community spaces with platform override;
- selected content classes use pre-moderation; new accounts have progressive anti-abuse limits;
- target notification channels include in-app, email, Web Push, Telegram and Discord;
- internal marketplace disputes are decided by authorized NEXUS staff; PSP/bank chargebacks remain external-provider processes;
- DRM: one free transfer about every 30 days; after 7-day grace protected resources hard-stop; telemetry minimal; no hardware fingerprint by default;
- open-source and closed-source products are both valid; source access can be a separately priced SKU/license.

## 30. PROVISIONAL autonomy rule

OWNER DECISION: when a detail is absent from the handbook, AI **may choose a safe, reversible implementation**, explicitly mark the decision `PROVISIONAL`, document the rationale and continue instead of blocking development for a question.

Do not use this permission for:

- production deployment;
- destructive production data operations;
- irreversible migrations with material data-loss risk;
- real payment/provider activation, legal/tax commitments or transfer of real funds;
- weakening security/privacy controls;
- publishing defamatory/high-severity trust labels without established policy/evidence;
- secret/key handling that changes the trust boundary.

For those, keep the human gate.

## 31. Owner review Round 4 — mandatory context

The owner has confirmed:

- marketplace starts with **MTA Scripts**;
- product delivery is either closed code (DRM seller-opt-in) or open source (no DRM);
- seller sets price; Free/Premium, bundles, coupons and discounts are allowed;
- buyers receive future updates without extra charge by default; commercial products need changelog/version history;
- base seller payout hold is 7 days and may improve via transparent subscription/trust policy;
- NEXUS 10% commission is based on actual post-discount paid amount;
- seller cannot perform untracked unilateral refunds;
- seller analytics is required;
- claimed server pages receive broad customization, public team/recruitment/factions/applications/events;
- organizations are universal, multi-membership, granular-permission entities;
- DMs are required by first commercial version; groups/clans and rich forum tools are target;
- server discovery uses both ranking and filters; marketplace uses multiple ranking signals;
- delegated product decision: sponsored placements may be native in fixed labeled slots but never alter organic rank;
- recommendations are enabled but user can fully opt out;
- SCAM/BLACKLIST remains until manual review changes it; transparency reporting is required;
- Seller/Publishing Agreement is required before first sale;
- services/custom development and Deal/Guarantee are confirmed target domains;
- success is measured as an ecosystem metric portfolio, not one isolated number.

Do not confuse target confirmation with current runtime. Paid commerce, payouts, services guarantees and production DRM still require implementation and explicit production/legal/provider activation.

## Round 5 instructions for AI

Treat these as owner decisions:

- build cart rather than limiting target commerce to Buy Now;
- default paid license scope is one MTA server;
- do not promise permanent redownload: target retention after delist/seller ban is 30 days, with security/legal overrides;
- trial/demo is supported but seller-opt-in;
- wishlist and unified support are target requirements;
- seller may define included support duration;
- local-currency estimates are display-only unless provider settles in that currency;
- tax/VAT should use provider/MoR capabilities where practical;
- seller balance is a settlement UI, not evidence that NEXUS custodies money;
- keep current MTA challenge as server-claim proof until owner changes it;
- support multiple server co-owners and audited ownership transfer;
- do not expose live player identities by default;
- Organizations can be seller/billing/payout entities;
- default strangers to Message Request; context participants can communicate directly;
- block/private groups required; voice/video not required;
- one Home architecture for guest/auth states;
- onboarding required;
- do not build global command palette/command UX as target;
- target first public launch is Open Beta for all;
- never enable production payments without the explicit production checklist + human gate.

### Round 6 closes the DRM retention edge

The 30-day rule limits NEXUS redownload/hosting after delist/seller ban. It does **not** automatically kill an already activated DRM license on day 30. The license continues until the end of its contractual paid term; malware/legal/security revocation may override normal commercial expiry. Keep download retention, license expiry and security revocation separate in code/domain state.

## Round 6 instructions for AI

Treat these as owner decisions:

- after login stay on Home; do not force a dashboard landing;
- build one adaptive `/workspace` rather than separate role accounts/cabinets;
- seller/server/org dashboards use the full confirmed management/analytics blocks;
- Buyer Library has Purchased/Free/Trials/Licenses/Updates/Support/Invoices plus per-purchase detail;
- product pages/cards expose source model and DRM state clearly; rich media is allowed;
- compatibility metadata is optional, dependency graph required, automatic compatibility inference rejected for now;
- delisted products are frozen for ordinary new releases; safe free builds may have longer retention;
- active DRM after the 30-day hosting window lives until its contractual paid term;
- subscription can improve support routing but never moderation/dispute fairness; pre-sale support can be opened by any user;
- Home uses finite sections; Community Feed may infinite-scroll; `/discover` is required;
- public profile defaults to safe public visibility; immutable ID is primary; subscription may add vanity username;
- verified external links prove control only;
- admin global case search, quarantine, malware downloader notifications and Security Center are target requirements;
- role alone does not mandate 2FA;
- raw payment payloads require separate restricted debug access;
- API keys/webhooks are not launch requirements; when external API ships, first support authenticated partners/Pro rather than anonymous public API;
- no public platform Status Page requirement; internal observability still required;
- keep top navigation Home / Servers / Market / Community / Messages / Notifications / Workspace/Profile and make Discover clearly reachable.

## 18. Round 7 implementation constraints

AI MUST preserve:

- email/password as primary login; social accounts are identity verification links, not login providers unless owner later changes this;
- verified-email gate for state-changing user actions;
- account deletion as orchestrated archive/retention workflow, not blind cascaded delete;
- guest cart + server-side checkout revalidation;
- 30-day activation deadline for paid unbound licenses;
- seller KYC before first payout/provider-required earlier gate;
- subscription auto-publish never bypasses automated safety/risk gates;
- public archived product transparency where legal/security allows;
- one senior authorized Trust/Admin may issue SCAM verdict with evidence/audit/appeal;
- no universal two-person approval requirement for refunds/payout corrections;
- in-app + email + Web Push for release; Telegram/Discord bots deferred;
- PWA/themes/WCAG 2.2 AA are release-quality requirements;
- record-specific retention rather than one global TTL;
- user Activity & Security Log;
- hidden/internal analytics signals must still be privacy-policy/legal compliant and purpose-limited.


## Round 8 screen-level implementation constraints

The owner has now approved screen-level information architecture. Before inventing UI, consult `44` through `51`.

Non-negotiable additions:

- `/discover` must not use one mixed heterogeneous entity stream; use separate entity sections/tabs.
- Guest browsing is public and CTA-driven, not registration-wall driven.
- Buyer purchase details use tabs and activation reminders at 7/3/1 days.
- Seller publish is a full-page wizard; promotions have a dedicated manager.
- Server team and Organization permissions share one capability engine.
- Organization Finance is capability-separated.
- Staff high-impact actions require impact preview; Super Admin emergency tools live in a separate System area with reason/re-auth/audit.
- Plan economics must be transparent.
- Vanity username has a 7-day expiry grace.
- Offline PWA blocks sensitive writes.
- Error surfaces may show correlation/request ID, never internal stack traces.
- Dedicated public Trust/Reputation profile tab is OWNER-CONFIRMED: show evidence/history, not one opaque score; redact internal/sensitive details.


## Round 9 handoff additions

Do not re-open the following unless implementation uncovers a real contradiction:

- baseline marketplace commission is 10%; later paid Creator plans may reduce it, exact table OPEN;
- baseline new-seller payout hold is 7 days and can be reduced by approved trust/subscription policy;
- Creator Free exists; paid Creator automation never bypasses mandatory security/policy checks;
- dedicated public Trust/Reputation tab is required and is evidence-based, not a score;
- finalized public moderation history is retained with state and redactions;
- perpetual and time-limited product licenses both exist;
- perpetual DRM rights remain indefinite after activation unless formally revoked/malware/legal/security intervention applies;
- forensic watermarking is opt-in evidence and never sufficient alone for automatic guilt;
- production commercial artifacts use private object storage + signed delivery;
- scanner backends are pluggable; ClamAV is baseline;
- payment-provider choice remains a production business/legal decision.

`OBS-010` remains OPEN. Do not silently bind the project to Sentry, Datadog, Grafana Cloud, Better Stack, provider-native monitoring or another paid observability vendor as an owner-approved choice. A reversible local/dev setup may still be used as PROVISIONAL engineering work.