# 28. Cart, Licenses и Access Rights

## 1. Назначение

Эта глава определяет коммерческий путь от выбора нескольких товаров до выдачи прав и поведение доступа после delist/seller ban.

Статус: **TARGET / OWNER-CONFIRMED**. Текущая closed beta paid commerce не активна.

## 2. Cart model

Пользователь может собрать несколько marketplace items в одну корзину.

Cart item содержит минимум:

- product/SKU identity;
- seller/organization seller identity;
- edition/delivery mode;
- quantity where policy allows;
- authoritative unit price reference;
- selected coupon/promotion result;
- currency;
- license scope preview;
- current availability.

Client cart — только удобное состояние. Перед checkout сервер пересчитывает всё заново.

## 3. Server-authoritative checkout

Перед созданием payment intent система повторно проверяет:

1. product/SKU published и sellable;
2. build/delivery artifact safe and eligible;
3. seller not suspended from selling;
4. buyer allowed to purchase;
5. current price/discount/coupon;
6. provider/currency compatibility;
7. tax/VAT calculation result;
8. duplicate/idempotency rules;
9. license constraints.

Если один cart item invalid, UI должен объяснить конкретно какой item и почему. Нельзя молча изменить цену или удалить товар.

## 4. Order decomposition

Один Order может иметь несколько OrderItems. После provider confirmation каждый item получает собственный Purchase/License/Entitlement state.

Это позволяет:

- refund одного item;
- dispute одного item;
- seller settlement по item;
- разные sellers в одном cart, если provider architecture это поддерживает;
- не ломать остальные покупки из-за одного проблемного ресурса.

## 5. One license = one server

OWNER DECISION: default commercial license authorizes one MTA server.

Conceptually:

```text
Purchase Item
  -> License
  -> Server binding
  -> Optional DRM activation
  -> Lease / grace policy
```

Несколько серверов требуют несколько license units. Unlimited/multi-server SKU не является default и не должен появляться без отдельного owner/business decision.

## 6. Closed vs open source

- Closed code: DRM seller-opt-in.
- Open source: no DRM protection.
- Both still have contractual license terms, purchase history and support/update policy.

## 7. Delist retention

Если seller добровольно снимает product с продажи:

- новые purchases прекращаются;
- existing buyers видят delisted status/reason where allowed;
- NEXUS сохраняет разрешённый download/access window **30 дней**;
- после 30 дней permanent redownload через NEXUS не гарантируется.

Seller обязан видеть это правило до delist confirmation.

## 8. Seller-ban retention

Если seller теряет право продажи/получает ban:

- good-faith buyers получают 30-дневное transition window;
- payout/dispute/security policy может freeze funds;
- malware/legal takedown может немедленно закрыть download;
- buyer notification объясняет причину настолько полно, насколько позволяет safety/legal/privacy.

## 9. DRM edge after access window

Уже активированная DRM-license сохраняет договорный срок после закрытия окна скачивания: perpetual остаётся бессрочной, fixed-term/subscription действует до оплаченного окончания. Malware/legal/security revocation может иметь приоритет. Окно хранения, срок лицензии и 7-day offline lease grace имеют разные значения; см. LIC-011 и [модель лицензий](54-LICENSE-MODELS-FORENSICS-AND-REVOCATION.md).

## 10. Audit requirements

Audit events минимум:

- cart checkout validation;
- order created;
- payment confirmed;
- purchase/license issued;
- server binding changed;
- product delisted;
- seller suspended;
- access-window start/end;
- download attempt after window;
- security/legal override.

## 12. guest cart, activation deadline и download trust

### 12.1 Guest cart

Гость может собирать корзину до регистрации. Guest cart является convenience state, а не заказом или reservation:

- цены/availability не фиксируются навсегда;
- перед checkout требуется login/register;
- email должен быть verified для завершения покупки;
- server повторно валидирует все SKU, prices, discounts, currency/provider и eligibility;
- guest cart может быть merge-нута с account cart по безопасному deterministic policy.

### 12.2 Binding after purchase

Commercial license покупается **до server binding**. Это позволяет купить script заранее, а потом выбрать нужный MTA server.

OWNER DECISION: оплаченная, но не привязанная license имеет **30-дневное activation window**. Она не может лежать неактивированной бессрочно.

Минимальная модель:

```text
paid -> unbound -> bound/activated
          | 30 days
          v
       activation_expired
```

`activation_expired` не означает автоматический refund. Support/dispute exception возможен только по policy и audit trail.

### 12.3 Trial binding

Trial:

- относится к одному server;
- имеет короткий срок;
- имеет ограничение transfer/rebind;
- может использовать DRM lease, если seller включил DRM;
- не превращается в постоянную лицензию простым повторным созданием trial.

### 12.4 Download trust surface

Download screen показывает технические доказательства, достаточные для ручной проверки:

- product/build/version;
- SHA-256;
- malware scan state;
- scanner/provenance;
- signature/integrity metadata, если применимо;
- release timestamp;
- source/DRM model;
- security warning/quarantine state.

Пользователь не обязан понимать криптографию, но техническая проверяемость должна быть доступна.

## 13. Закрытая beta — библиотека действующих прав (реализовано)

Новый приватный маршрут `/workspace/library` заменяет старую модель, при
которой кабинет читал **все** entitlements и licenses пользователя в память.
Теперь сервер выполняет две ограниченные SQL-выборки: точный счётчик с
разбиением на `all / ready / unavailable`, затем страницу записей, с
стабильным порядком `MAX(grant.created_at) DESC, resource_id ASC`.
На странице не больше 12 элементов; превью основного кабинета ограничено 4.

Право `product.download` складывается из двух совместимых источников:
действующие `user` entitlements с таким permission и исторические активные
licenses с ещё не истёкшим сроком. Дубли разных грантов одного ресурса
показываются одной строкой. Отозванные, приостановленные, истёкшие лицензии,
истёкшие entitlement и права `product.update` не создают карточку.

`ready` означает одновременно опубликованный продукт и наличие хотя бы
одной опубликованной сборки с проверенным `clean`-сканом, именем сканера
и временем проверки. Сведения о draft/suspended/archived карточке не
выдаются: заголовок, slug, версия и кнопка скачивания отсутствуют.
Недоступный ранее приобретённый ресурс остаётся в приватной библиотеке
без утечки его метаданных. Ресурсы с historical paid license могут
отображаться **только** при действующем праве; это не открывает checkout.

Надпись `ready` — лишь подсказка, **не авторизация**: запрос на файл
по-прежнему проверяет сессию, права, актуальный статус продукта, trusted
scan и аудит скачивания непосредственно на сервере. Доступ может
измениться между рендером и скачиванием, тогда сервер обязан отказать.

Ограниченная SQL-пагинация, фильтры, RU/EN, robots noindex и контроль
отсутствия утечек покрыты тестами. Интеграционные тесты PostgreSQL,
миграция `0036_user_library_lookup_indexes`, rollback/retry и полная
сборка требуют подтверждения на CI. Коммерческие платежи, DRM и выдача
новых платных лицензий **не** реализуются этим изменением.
