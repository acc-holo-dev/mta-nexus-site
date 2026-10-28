# Коммерческая модель

Реальные платежи и выплаты в текущей бесплатной закрытой бете выключены. Ни наличие commerce-таблиц, ни утверждённая цель не разрешают их включение. Первая публичная бета может открыться с бесплатными сценариями до отдельной приёмки платежей.

## Утверждённая цель

| Область | Правило | Подробный контракт |
|---|---|---|
| Marketplace | Первый коммерческий vertical — MTA Scripts. Free/Premium, bundles, Open/Closed Source и отдельный source SKU допустимы. Seller задаёт цену; hard minimum не введён. | [Жизненный цикл](23-MARKETPLACE-PRODUCT-LIFECYCLE.md), [доставка](34-PRODUCT-PAGE-DEPENDENCIES-AND-DELIVERY.md) |
| Доход | Комиссия с реально оплаченной после скидки суммы; baseline и payout hold заданы в экономическом контракте. PSP fees зависят от провайдера. | [Экономика](52-PLAN-ECONOMICS-COMMISSION-AND-HOLDS.md) |
| Планы | Creator Free, специализированные pillar plans и bundle с разными возможностями; срок entitlement не привязан к одному PSP. Recurring renewal — возможный способ, а не единственная модель. | [Планы и монетизация](22-SUBSCRIPTIONS-PROMOTION-AND-MONETIZATION.md), [квоты](57-PLANS-QUOTAS-AND-ADMIN-CONFIG.md) |
| Разовые услуги | Продвижение и публикационные/операционные услуги допустимы. Первое рекламное размещение продаётся по фиксированной цене, явно маркируется и не меняет trust. | [Поиск и реклама](26-SEARCH-RANKING-ADS-AND-PERSONALIZATION.md) |
| Seller | Отдельное ручное seller-одобрение не обязательно; модерируется продукт. Платная автоматизация не обходит безопасность и целостность. | [Издатель](39-SELLER-PUBLISHING-KYC-AND-CATALOG-STATES.md) |
| Покупка и лицензия | Order, Payment, Entitlement и License имеют разный смысл. Получение исходников не передаёт copyright/IP без явной лицензии. Будущие обновления по умолчанию включены; платный major upgrade требует отдельного решения. | [Права доступа](28-CART-LICENSES-AND-ACCESS-RIGHTS.md), [лицензии](54-LICENSE-MODELS-FORENSICS-AND-REVOCATION.md) |
| DRM | Утверждённая часть коммерческого направления, seller opt-in для конкретного продукта; open source без DRM. Универсальный runtime, срок/lease/grace и transfer описываются отдельно. | [DRM](17-DRM-AND-LICENSING.md) |
| Платёжные провайдеры | Multi-provider/multi-method, законность и доступность по юрисдикции. Предпочтителен marketplace-capable provider с KYC/settlement/payout/reconciliation и минимумом ручной работы. | [Commerce и выплаты](18-COMMERCE-AND-PAYOUT-FLOWS.md) |
| Споры | Внутренний dispute с evidence, защитой средств где доступно, решением, возвратом/release/partial outcome и аудитом. Chargeback связан, но является отдельным процессом. Seller не делает произвольный внеплатформенный refund. | [Поддержка и споры](56-SUPPORT-SLA-AND-DISPUTE-TIMING.md) |
| Организации и услуги | Командный billing owner, отдельные финансовые права, услуги и гарантийные сделки. | [Организации](31-ORGANIZATION-COMMERCE-AND-MESSAGING-POLICY.md), [сделки](25-DEALS-SERVICES-AND-GUARANTEE.md) |

## Что нельзя продавать

Verification, стирание санкций, репутацию и обход hard safety/finance controls. Подписка может давать инструменты, автоматизацию и operational privileges по прозрачной risk policy. Высокое доверие не делает лимиты бесконечными.

## Условия включения

Юрлицо и юрисдикция, договоры PSP, поддерживаемые способы/валюты, KYC, налоги и учёт, условия возвратов/chargeback, резервы и settlement, реальные сверки, безопасность и восстановление должны пройти [production gate](32-LAUNCH-ONBOARDING-AND-PRODUCTION-GATES.md).

Точные цены, квоты, скидки комиссии и hold eligibility задаются утверждённой конфигурацией и решениями владельца. Не выдумывайте их при реализации. Статусы решений и оставшиеся вопросы находятся в [реестре](13-DECISION-REGISTER.md).
