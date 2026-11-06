# Коммерческое будущее: marketplace, DRM, планы и реклама

**Статус:** living · план/цель (не runtime free beta).  
**База DOC-05:** `385e577e7443cf7d7b817419ce5c3b8afe87b690`. Сохраняет утверждённые цели владельца; **не** активирует платежи, выплаты, live DRM или платный marketplace в бесплатной beta.

Связанные рамки: [PRODUCT.md](PRODUCT.md), [DECISIONS.md](DECISIONS.md), [handbook/13-DECISION-REGISTER.md](handbook/13-DECISION-REGISTER.md), [ROADMAP.md](ROADMAP.md) (F5/F6). Сценарии — [FLOWS.md](FLOWS.md); UI — [UX-CONTRACT.md](UX-CONTRACT.md); каталог/библиотека без активации платежей — [RESOURCES.md](RESOURCES.md); споры/staff — [TRUST-STAFF.md](TRUST-STAFF.md).

## Метки состояний

| Метка                | Значение                                                                            |
| -------------------- | ----------------------------------------------------------------------------------- |
| **текущий runtime**  | Подтверждено кодом/схемой на базе сверки; бесплатный контур, без live paid checkout |
| **цель владельца**   | Утверждённый target; отсрочка активации его не отменяет                             |
| **предложение**      | Нельзя строить как обязательство без нового указания владельца                      |
| **живой неизвестно** | Нужны legal/provider/evidence/конфиг до production; числа OPEN                      |

---

## 1. Граница ближайшего выпуска

**текущий runtime.** Реальные платежи и выплаты в закрытой бесплатной бете выключены. `CommerceService` сохраняет имя исторического сервиса, но платный checkout/license issuance намеренно отсутствуют; доступны free claim, чтение корзины/заказов и entitlement-совместимость. Приватная `/workspace/library` показывает действующие права (`product.download` из entitlements и неистёкших licenses) с пагинацией и без выдачи метаданных недоступных продуктов; надпись `ready` не является авторизацией скачивания. Unified support slice существует (cases, staff queue, RU/EN), без жёсткого публичного SLA и без произвольных purchase/license ID от клиента. Active DRM в closed beta не включён (DRM-001).

**Администрирование планов:** запросы создания, изменения и смены статуса требуют `X-Nexus-Actor-Id` исходного администратора. При неизвестном результате форма сохраняет в текущей вкладке несекретный маркер и блокирует повтор до явной ручной проверки; это не включает платежи.

**Отмена неоплаченного заказа:** `POST /api/orders/:id/cancel` требует `X-Nexus-Actor-Id` исходного покупателя. При неизвестном результате форма сохраняет исходный запрос в sessionStorage вкладки и предлагает явный точный повтор, в том числе после изменения статуса заказа. Это не выполняет платёж.

**Текущий API бесплатной подписки.** `POST /api/subscriptions/account` требует `X-Nexus-Actor-Id` исходного пользователя. При неопределённом ответе форма сохраняет в sessionStorage вкладки исходную команду, request ID и условия; панель восстановления позволяет повторить её явно. Это не включает платежи.

**цель владельца.** Первый коммерческий vertical — MTA Scripts: Free/Premium, bundles, Open/Closed Source и отдельный source SKU. Seller задаёт цену; универсальный hard minimum не введён — effective floor = `max(provider minimum, configured currency floor, fee-safety floor)`. Отдельное ручное seller-одобрение не обязательно; модерируется продукт. Платная автоматизация не обходит безопасность и целостность.

**предложение / F5–F6.** Ближайший рекламный вариант — ограниченный **staff-managed pilot** (F5): явная маркировка, допустимые слоты, измерения. **Self-service campaign, checkout рекламодателя, выплаты и коммерческий DRM** относятся к **F6** и требуют отдельного проектирования и приёмки ([PRODUCT.md](PRODUCT.md), NX-010, ROADMAP). Наличие sponsored badge в UI не означает готовый placement service.

**живой неизвестно.** Юрлицо, юрисдикция, договоры PSP, валюты/методы, KYC, налоги, refund/chargeback policy, резервы, settlement и сверки — до [production gate](PRODUCT.md). Точные цены, квоты, таблицы скидок комиссии и hold eligibility задаёт утверждённая конфигурация владельца; при реализации их не выдумывать.

---

## 2. Модель дохода и запреты

**цель владельца.** Допустимые источники: комиссия marketplace, подписки (pillar + bundle), fixed-price promotion, выбранные one-time publishing/operational услуги, services/custom development и Deal/Guarantee.

**Что нельзя продавать (исключения без ослабления):**

- verification / Verdikt доверия;
- стирание законных санкций / SCAM/blacklist removal;
- fake reviews/ratings и reputation points без evidence;
- скрытое изменение organic ranking / popularity;
- bypass malware/integrity/authz / false Clean Build;
- благоприятный moderation или dispute outcome;
- бесконечные лимиты «из-за высокого доверия».

Подписка может давать инструменты, автоматизацию и operational privileges по прозрачной risk policy — не истину trust.

---

## 3. Доменные границы checkout и выплат

**цель владельца.** Разделять: `Order`, `Payment`, `Purchase`, `License/Entitlement`, `Ledger`, `Payout`, `Refund`, `Dispute`. Клиентский redirect **никогда** не доказывает оплату.

Поток: `Buy → immutable order snapshot → PSP checkout → verified webhook/API → payment succeeded → purchase → license/entitlement → accounting`.

**Комиссия (ECON-001):** **10%** от суммы, реально оплаченной покупателем после скидок. PSP fees/tax/settlement — по provider/legal contract. Future Creator subscriptions могут снизить процент; exact rates **OPEN**.

**Hold (ECON-002):** baseline нового seller — **7 дней** до payable/settled. Subscription / verification / healthy history могут сократить к ~1–3 дням. Никакой план не отменяет fraud/chargeback/dispute/compliance/provider reserve.

**Провайдеры (PAY-010):** multi-provider/multi-method через capability matrix. Предпочтение: marketplace-capable PSP со split/settlement/KYC/payout и минимумом ручных операций владельца. Internal ledger — fallback с большей legal/accounting нагрузкой.

**Refund (COM-001):** digital download не означает автоматический no-refund. Минимум причин: materially не работает / не соответствует описанию; duplicate; fraud/unauthorized; staff-approved exceptions. Seller **не** имеет untracked unilateral refund. Windows/evidence/partial — launch policy (**OPEN**).

**Споры (COM-002):** internal dispute решает authorized staff по evidence; PSP/bank chargeback — отдельный внешний процесс с reconciliation. Исход не следует автоматически из пропущенного internal target time.

**Cart:** коммерческий checkout строится вокруг **cart** (не только Buy Now). Guest cart — convenience до login; email verified для завершения; сервер пересчитывает всё заново. Один Order → несколько OrderItems с независимыми Purchase/License/refund/dispute. Invalid item объясняется явно; молча менять цену/удалять нельзя. Target server в cart optional (CART-002); финальный binding — server-authoritative.

**Tax:** где возможно — PSP/MoR/marketplace capability; NEXUS не становится налоговым движком без необходимости.

**Seller balance UI:** pending / on hold / available / paid / refunded / disputed/reserved / commission / PSP fees. Не называть provider-held funds «банковским счётом NEXUS» или wallet, если это не wallet. Receipts/invoices — provider-backed, с immutable order/payment identifiers.

**30-day delist/seller-ban access:** existing buyers получают **30 дней** redownload/hosting последней разрешённой версии. Исключения: malware/security — немедленное закрытие; legal/copyright/provider order — иной срок; уже полученный open-source copy физически не «отзывается». Правило заметно в Seller Agreement, purchase UI и Refund Policy. **Не путать** с сроком DRM-license (ниже).

---

## 4. Планы, квоты и экономика

**цель владельца.** Одновременно допустимы специализированные plans по pillars (Creator/Developer, Server, Organization, …) и umbrella `NEXUS Pro`. Ladders могут различаться (SUB-010/011). Срок entitlement конфигурируем примерно **7 дней – 1 год**; prepaid и recurring сосуществуют (SUB-012). Exact prices/SKUs **OPEN**.

| Семья        | Free                                                         | Paid (ориентиры)                                                                                                                                                                        |
| ------------ | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Creator      | Реальная продажа, manual moderation, 10% commission, hold 7d | Pro/Business: auto-publish eligibility (без bypass safety), analytics/automation/promotion, квоты; целевые commission **8% / 6%**, hold **3d / 1d** при trust/risk/provider eligibility |
| Server       | Core claim/directory, правдивый status                       | Pro/Business: page/media/analytics/team/promotion/ops; exact names **OPEN**                                                                                                             |
| Organization | Identity, members, collaborative ownership                   | Pro/Business: team/assets/billing/audit; billing **per organization**, не per-seat по умолчанию                                                                                         |
| NEXUS Pro    | —                                                            | Максимальный cross-pillar bundle; включает benefits для **одной** выбранной Organization; без unlimited по умолчанию; discounts не stack ниже best eligible rate без явной admin policy |

**One-time (SUB-013, ECON-005):** в первую очередь ads/promotion и publishing/operational services (ускоренная публикация и т.п.). Auto-publish остаётся **subscription-only**. Profile cosmetics — не главный one-time продукт.

**Expiry (SUB-014):** paid-only automation/promotions/capabilities останавливаются; config/data сохраняются для restore; уже купленные purchases/licenses живут по своему контракту.

**Vanity username:** после expiry entitlement — **7-day** grace/reservation; затем slug освобождается. Immutable User ID не меняется.

**Публичный `/pricing` (PRICE-001/002):** сравнение Creator / Server / Organization / NEXUS bundle; transparent commission, hold advantages, automation, promotion, expiry. Contextual upsell ведёт к тем же деталям. Base prices глобально согласованы; local currency display/estimate допустим.

**Trial max default:** 7 дней. Included support periods seller/product: 7 / 30 / 90 / 365 дней. Ordinary dispute window default: **14 дней** (конфиг). Artifact-size: **PROVISIONAL** 512 MiB per build до telemetry. Payout floor — prefer provider minimums.

**Admin config:** plan/economics changes требуют capability, re-auth для sensitive finance, reason, actor/timestamp, old/new, effective version, immutable audit, impact preview. Orders/subscriptions/payouts хранят snapshot применённой политики.

---

## 5. Лицензии, DRM, lifetime / offline / revocation

**цель владельца (сохранять без упрощения).** DRM capability обязательна в target commercial architecture; **seller opt-in** на продукт (DRM-002/007). Open source — без DRM. Lifecycle: `Purchase → License → Installation/Server → Activation → Lease` (не один flag).

**Universal runtime:** один compiled module на многие серверы; индивидуализация через license ID, binding, signed activation/lease, entitlements, keys/config, revocation — **без** per-customer rebuild.

**Default license:** 1 commercial license = **1 MTA server**. Unlimited/multi-server SKU только отдельным решением. Покупка **до** binding; unbound paid license — **30-day activation window** (LIC-002); `activation_expired` ≠ auto-refund. Reminders 7/3/1 дней (LIC-004).

**Модели (LIC-010):** perpetual / time-limited / subscription-bound. По умолчанию покупка включает будущие версии; платный major upgrade — отдельное решение. Source SKU — отдельно priced entitlement с честным UI (binary vs source vs DRM).

**Perpetual + offline grace (LIC-011, DRM-006/010/012) — жёсткие различия:**

- после валидной activation perpetual DRM даёт indefinite product-use rights;
- **7-day grace** — только offline lease tolerance при недоступности NEXUS/network, **не** срок покупки и не «убийство» perpetual через 7 дней нормальной работы;
- после grace без valid lease — **hard stop** с предсказуемым локальным статусом; recovery без customer-specific recompilation;
- 30-day redownload window ≠ DRM kill switch: активированная license живёт до конца **договорного оплаченного срока** (fixed-term / subscription expiry / perpetual без выдуманного expiry от delist);
- malware / legal / security revocation может supersede commercial expiry.

**Transfers (DRM-009):** один бесплатный перенос ~каждые 30 дней; чаще — support/review.

**Forensics (DRM-008/014/015/016):** seller-opt-in watermark/fingerprint без rebuild universal runtime. Match = evidence/case, **не** auto-ban / auto-SCAM / revoke unrelated. Seller видит suspicion/status, не raw anti-abuse signals/algorithms.

**Revoke (DRM-013):** seller-initiated только через structured allowed reason (refund, confirmed fraud, contractual violation, …), impact preview, audit, review, buyer notification/appeal. Нет unreasoned «Disable license».

**Privacy telemetry (DRM-011):** минимум — license ID, server/installation ID, resource/version, timestamp/heartbeat; IP только при реальной необходимости; hardware fingerprint — только отдельно обоснованно.

**Buyer trust UI до покупки:** DRM on/off, binding, 7-day grace, transfer limits, required runtime, refund/dispute consequences, telemetry.

**Crypto:** legacy Ed25519/AES-GCM — reference only; target проходит новый threat model. Private signing keys не в module.

**живой неизвестно.** Точное поведение уже активированной DRM-license после истечения 30-day hosting window должно быть явно специфицировано до production commerce — не выводить из delist-правила молча.

---

## 6. Services, Deals и Guarantee

**цель владельца.** Custom development/services + структурированный Deal/Guarantee. Funds flow — через PSP marketplace/escrow-like capabilities, **не** самодельный unaudited wallet.

Стабильные domain states: `DRAFT → PROPOSED → ACCEPTED → FUNDED/PROVIDER_SECURED → IN_PROGRESS → DELIVERY_SUBMITTED → ACCEPTED → SETTLEMENT_PENDING → COMPLETED` (или `DISPUTED → REVIEW → RESOLVED`). До оплаты фиксируются scope, deliverables, price, milestones, license/source/DRM, evidence policy, acceptance, refund/dispute. Существенные изменения после funding — explicit amendment обеих сторон.

Dispute outcomes: full refund / full settlement / partial (если provider) / revised window / sanctions. Default commission philosophy 10%; отдельный service fee — только после явного pricing decision. Completed deal → eligibility на verified service review без утечки private source/secret terms. Нужны anti-collusion, fraud checks, rate limits, holds, audit, appeal.

**живой неизвестно.** Provider/legal validation обязательна до activation.

---

## 7. Реклама, ranking и персонализация (коммерческая часть)

**цель владельца (ADS-001/002, marketplace ranking).** Initial advertising — **fixed-price**, не auction. Sponsored cards только в заранее определённых слотах; явная маркировка `Sponsored`/`Реклама`; visual отличие от organic; spend **не** меняет organic score; safety/trust/verification badges с placement не покупаются. Dedicated Promotions Manager для boosts/featured/campaign history.

Marketplace organic signals: relevance, sales, rating, freshness, update frequency, seller trust — без скрытого paid boost. Anti-manipulation: fake downloads/purchases, review rings, follow farming, update spam, paid traffic as organic, coordinated review abuse.

**F5 vs F6 (критичное различение):**

|            | Staff-managed pilot (F5)                                                         | Self-service / commerce (F6)              |
| ---------- | -------------------------------------------------------------------------------- | ----------------------------------------- |
| Управление | Staff/оператор                                                                   | Рекламодатель self-serve                  |
| Оплата     | Вне или без live self-checkout                                                   | Checkout, обязательства, биллинг          |
| Статус     | Предложение/нужен продуктовый выбор слотов и lifecycle                           | Отдельная коммерческая программа          |
| Граница    | Органика, trust, auth, download, support не превращаются в преграду ради показов | Выплаты, DRM, payouts — только после gate |

**предложение.** Конкретный lifecycle placement, no-fill, hide/report rules, measurement units (impression/click/useful action) — UX-24/26; whitelist поверхностей — UX F5. Personalization inputs и full opt-out — owner-delegated target; explainability типов причин без anti-abuse weights. Детали organic search UX — [UX-CONTRACT.md](UX-CONTRACT.md).

**текущий runtime.** Sponsored badge / labeling primitives могут существовать; законченный runtime placements и live inventory **не** установлены (**живой неизвестно** на production).

---

## 8. Trial, wishlist, support и billing UX

**Текущий API рассмотрения обращения:** `POST /api/admin/commerce/order-cases/:id` требует `X-Nexus-Actor-Id` исходного сотрудника. Если результат неизвестен, форма блокирует повтор до обновления; решение не выполняет перевод денег.

**цель владельца.** Trial — отдельный entitlement (не fake zero-price Purchase): время, один server, activation/download limits, feature flags, optional DRM lease, cooldown; conversion сохраняет server context. Wishlist private by default; target notifications: price drop, promotion, new stable, back in stock, opted-in seller announcement.

Unified NEXUS support (не потеря контекста в произвольных DM): case связан с purchase/license/activation/resource/build/seller/payment/dispute/server integration. Seller/team внутри системы; staff escalate по policy. Seller-defined support term на SKU **отличен** от license lifetime, update entitlement и platform support. Seller response time **не** обязательный public reputation signal.

Pre-sale support допустим где policy позволяет. Paid plan может ускорить routing/priority NEXUS support — **никогда** не покупает moderation/verification/dispute verdict (см. также §2).

Evidence attachments: screenshots, text, logs, safe docs, archives после malware scan; executables — не обычный path (отдельный quarantined staff channel). Size/type limits, private storage, immutable evidence IDs, audit.

Billing display: authoritative price/currency, approximate local (estimate), tax, discount, total, provider/method. Offline PWA: clear Offline; **блокировать** payment/checkout, license activation/transfer, publishing, moderation, ownership/finance — без optimistic enqueue (общая оболочка — UX-CONTRACT).

**текущий runtime.** Support cases без hard response-time promise; public create не принимает arbitrary related purchase/license/product IDs до server-side ownership verification; staff access временно через `admin.moderation`. Evidence attachments, seller routing, purchase auto-context, assignment/SLA automation — ещё не реализованы.

**цель владельца по приоритетам очереди (без публичного SLA до staffed org):** (1) critical malware/security; (2) payment/access failures broad impact; (3) active scam/abuse; (4) disputes/appeals; (5) ordinary support. Internal targets ≠ automatic win/refund/release.

---

## 9. Условия включения коммерции

До production activation нужны: legal entity/jurisdiction; PSP contracts; methods/currencies; KYC; tax/accounting; refund/chargeback terms; reserves/settlement; real reconciliations; security/recovery; threat-modeled DRM. Разрешение кода, наличие таблиц или «PASS в CI» **сами по себе не включают** платежи (NX-011, AGENTS).

Конфигурируемое минимум: plan prices/durations, commission %, hold rules, eligibility, quotas/storage/media/team, artifact-size, one-off promotion/publication prices, product price floors, payout floors, trial max, promotion inventory/capacity.

---

## Источники переноса (DOC-05)

Полностью учтены уникальные цели и исключения из:

- [handbook/06-BUSINESS-MODEL.md](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/06-BUSINESS-MODEL.md) (история; актуальный контракт — этот файл)
- [handbook/17-DRM-AND-LICENSING.md](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/17-DRM-AND-LICENSING.md) (история; актуальный контракт — этот файл)
- [handbook/18-COMMERCE-AND-PAYOUT-FLOWS.md](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/18-COMMERCE-AND-PAYOUT-FLOWS.md) (история; актуальный контракт — этот файл)
- [handbook/22-SUBSCRIPTIONS-PROMOTION-AND-MONETIZATION.md](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/22-SUBSCRIPTIONS-PROMOTION-AND-MONETIZATION.md) (история; актуальный контракт — этот файл)
- [handbook/25-DEALS-SERVICES-AND-GUARANTEE.md](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/25-DEALS-SERVICES-AND-GUARANTEE.md) (история; актуальный контракт — этот файл)
- [handbook/26-SEARCH-RANKING-ADS-AND-PERSONALIZATION.md](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/26-SEARCH-RANKING-ADS-AND-PERSONALIZATION.md) (история; актуальный контракт — этот файл) — ads/ranking commercial
- [handbook/28-CART-LICENSES-AND-ACCESS-RIGHTS.md](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/28-CART-LICENSES-AND-ACCESS-RIGHTS.md) (история; актуальный контракт — этот файл)
- [handbook/29-SUPPORT-TRIAL-WISHLIST-AND-BILLING-UX.md](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/29-SUPPORT-TRIAL-WISHLIST-AND-BILLING-UX.md) (история; актуальный контракт — этот файл)
- [handbook/51-PRICING-SUBSCRIPTIONS-ERROR-OFFLINE-UX.md](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/51-PRICING-SUBSCRIPTIONS-ERROR-OFFLINE-UX.md) (история; актуальный контракт — этот файл) — pricing/subscription/offline finance UX
- [handbook/52-PLAN-ECONOMICS-COMMISSION-AND-HOLDS.md](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/52-PLAN-ECONOMICS-COMMISSION-AND-HOLDS.md) (история; актуальный контракт — этот файл)
- [handbook/54-LICENSE-MODELS-FORENSICS-AND-REVOCATION.md](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/54-LICENSE-MODELS-FORENSICS-AND-REVOCATION.md) (история; актуальный контракт — этот файл)
- [handbook/56-SUPPORT-SLA-AND-DISPUTE-TIMING.md](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/56-SUPPORT-SLA-AND-DISPUTE-TIMING.md) (история; актуальный контракт — этот файл)
- [handbook/57-PLANS-QUOTAS-AND-ADMIN-CONFIG.md](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/57-PLANS-QUOTAS-AND-ADMIN-CONFIG.md) (история; актуальный контракт — этот файл)

Стабильные ID (LIC-_, DRM-_, COM-_, ECON-_, SUB-_, ADS-_, PRICE-_, PAY-_, CART-*) остаются каноническими в Decision Register; этот файл — смысловой предметный контракт, не замена реестра. Удаление исходных handbook-глав — только DOC-04 после сверки.
