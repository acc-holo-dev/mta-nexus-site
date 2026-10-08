# MTA NEXUS — PWA, Themes, Accessibility и Notifications

> Статус: OWNER DECISION / TARGET SPEC, Round 7.

## CURRENT implementation status — 2026-10-07

В `main` реализован первый безопасный PWA slice:

- installable Web App Manifest и maskable-capable SVG icon;
- production-only registration service worker;
- Light / Dark / System theme modes; System реагирует на изменение OS color scheme без перезагрузки;
- network-first navigation: при сетевой ошибке ранее просмотренный и явно разрешённый anonymous public read-only document может открыться из bounded offline cache; для остальных navigation показывается self-contained offline shell;
- service worker не кеширует HTML пользовательских/private страниц и не перехватывает non-GET mutations;
- immutable runtime cache разрешён для same-origin `/_next/static/` assets и ограничен 96 entries; отдельный public-document cache ограничен 24 entries и допускает только `/articles`, валидный `/articles/<slug>`, `/privacy`, `/terms` и `/copyright`;
- public document сохраняется только после успешного same-origin HTML response с серверным `X-Nexus-Offline-Cache: public-readonly-v1` и `Vary: Cookie`. Next.js Proxy выдаёт marker только GET-запросу без `nexus_session`; наличие даже stale/invalid session cookie fail-closed отключает opt-in. Market, checkout, support, notifications, security, settings, workspace, servers, profiles и API этим cache contract не охвачены;
- добавлены session-bound browser Web Push subscriptions: authenticated subscribe/unsubscribe API, VAPID public-key gate и safe same-origin notification click handling; завершение серверной session каскадно удаляет её push subscription; VAPID/p256dh принимаются только как 65-byte uncompressed P-256 (`0x04`), auth secret — ровно 16 bytes; production config принимает VAPID public/private/subject только полным набором, проверяет public point на P-256 и криптографически подтверждает, что public/private образуют одну пару и передаёт его через production Compose; delivery runtime уже реализован и остаётся выключенным, пока полный VAPID набор не настроен; уже истёкшие subscription payloads отклоняются, а repository не считает активными endpoints с истёкшим `expiration_at` или истёкшей session; unique push endpoint не может быть перепривязан другой session через upsert — API отвечает 409, а browser self-heal отписывает локальную конфликтующую subscription, создаёт новую и повторяет регистрацию один раз; subscription mutation сериализуется по session, expired rows очищаются перед вставкой, а одна session ограничена 8 stored endpoints с отдельным `WEB_PUSH_SESSION_LIMIT` 409; Settings сверяет локальный PushSubscription с сервером по SHA-256 endpoint fingerprint (capability URL не попадает в query), поэтому другой endpoint той же session больше не даёт ложный Enabled state; дополнительно сравнивается `subscription.options.applicationServerKey` с текущим VAPID public key — после key rotation старый endpoint best-effort удаляется на сервере, локальная subscription отписывается и следующий Enable создаёт subscription уже на новом ключе; rejected 409 local orphan тоже отписывается;
- offline shell явно сообщает, что покупки, публикация, модерация и другие state-changing actions не подтверждаются без authoritative server response.

Chromium release acceptance теперь также покрывает RU/EN login и password-recovery UI, а после реального входа — Settings, Security Center, Support, Publish и disposable unowned Server Claim: keyboard focus, accessible labels, live error/status semantics, reduced-motion и reflow на 320/390/1280 px. Reduced-motion contract останавливает повторяющиеся animations, сокращает transitions и принудительно отключает smooth scrolling. Claim acceptance не запускает внешний master-list challenge и проверяет только безопасный UI до state-changing действия. Semantic text/faint/accent tokens теперь защищены математическим regression-тестом: normal-size text >= 4.5:1 на semantic surfaces, solid accent >= 4.5:1 с белым label и >= 3:1 как focus indicator. Status palette разделена на foreground и solid-action tokens: success/warning/danger/purple foreground >= 4.5:1 на semantic/soft surfaces, а solid success/warning/danger >= 4.5:1 с белым label. Shared `Dialog` теперь имеет unique ARIA IDs, возвращает фокус вызывающему элементу и циклически удерживает Tab/Shift+Tab внутри modal. Notification bell и full Notification Center отдельно озвучивают подтверждённый server-side `mark all read` через polite live status, а ошибки остаются assertive alerts. Chromium acceptance дополнительно требует ровно один видимый `main`, один видимый `h1` внутри него, непустые headings и именованные navigation landmarks, если на экране их несколько. Это scoped browser acceptance, не полная assistive-technology/WCAG-сертификация.

Free-resource acquisition acceptance теперь дополнительно проходит keyboard-only Add-to-library → claim → return → download error/cancel и reflow 320/390 px поверх реального entitlement/download flow. Closed-beta paid-resource state также проходит RU/EN Chromium acceptance на 320/390 px: semantic resource summary, явное объяснение отключённого paid checkout, disabled action связан с этим объяснением, а browser подтверждает отсутствие checkout/free-claim mutations. Реальный paid cart/checkout/license/payment flow остаётся отдельным будущим commerce gate и не симулируется до включения платежного продукта.

Web Push crypto core теперь реализует RFC 8291 single-record `aes128gcm` encryption на стандартном Node crypto и проверяется точным опубликованным RFC test vector; interoperability guard ограничивает полный encrypted body 4096 bytes, то есть максимум 3993 plaintext bytes с обязательными 86-byte header + delimiter + GCM tag; VAPID builder создаёт origin-bound ES256 JWT с 12-hour expiry и `vapid t=..., k=...`, причём подпись проверяется в unit test. Web Push payload допускает click target только как same-origin absolute path (`/...`); external, protocol-relative и script-like targets отбрасываются до encryption. RFC crypto, anti-SSRF endpoint policy и HTTPS sender вынесены в единый server-only runtime `@nexus/db`, который используют и web validation, и production worker.

HTTP sender теперь использует обязательные `TTL`, `Content-Encoding: aes128gcm` и VAPID Authorization headers. Push endpoint проходит anti-SSRF policy: только HTTPS/443 hostname без credentials/fragment/IP literal; DNS проверяется целиком на public-only addresses, затем TLS соединение pinned к проверенному IP с исходным Host/SNI, поэтому повторное DNS-разрешение при connect не используется. Redirects sender не следует.

Notification delivery теперь имеет единый durable contract. Preference-aware inbox row остаётся источником истины; optional preference PATCH и preference-controlled notification creation используют один per-user transaction advisory lock, поэтому подтверждённое отключение категории не гоняется со stale snapshot notification; build-review multi-recipient path берёт те же locks в deterministic user-id order; обычный repository сохраняет inbox и ставит Web Push outbox jobs в одной transaction/savepoint boundary, а build-review и verification-resolution raw SQL paths делают то же внутри своей moderation transaction. Job создаётся отдельно для каждой активной browser subscription, поэтому partial success не требует повторной отправки на уже успешные устройства. Direct network delivery из HTTP/`after()` удалён: отдельный production `push-worker` lease-ит jobs, выполняет sender вне DB transaction, подтверждает 2xx, удаляет stale subscription на 404/410, retry-ит transport/408/425/429/5xx с deterministic backoff и максимум 5 attempts. `sendBefore`/DB-relative `sendWithinMs` теперь жёстко распространяются до HTTPS AbortSignal с запасом на settlement; worker не сравнивает PostgreSQL deadline с локальными wall-clock часами контейнера, поэтому clock skew не расширяет lease; expired lease owner не может ни ack/retry job, ни удалить stale subscription до reclaim, что сужает окно late/duplicate delivery. Queue-local failure не откатывает authoritative mutation/inbox; enqueue теперь различает `queued`, `no_subscriptions`, `saturated` и `error`, поэтому отсутствие браузерной подписки не смешивается с деградацией очереди. Worker health включает pending/due/leased/capacity/oldest-age counters и fail-closed при достижении capacity; heartbeat и dispatcher progress отслеживаются отдельно: свежий heartbeat больше не скрывает зависший main loop, а встроенный 180s watchdog принудительно завершает stalled worker, чтобы Compose restart policy действительно восстановила процесс после истечения безопасного lease; operational alerting отдельно отслеживает disabled-with-pending, 80% capacity pressure, 100 due jobs и oldest active age 900s (все пороги настраиваемые), пишет только aggregate `queue-alert`/`queue-recovered` transitions и доступен отдельным probe с exit 0/2/1. Expired/exhausted jobs обслуживаются maintenance даже при выключенном VAPID.

Closed-provider evidence теперь включает настоящий local TLS/SNI network round-trip через production Web Push runtime: VAPID Authorization, `aes128gcm`, encrypted <=4096-byte body, 201/410/503 и timeout проверяются без внешней сети. PostgreSQL soak одновременно запускает четыре dispatcher-а на перекрывающихся candidate lists и требует exactly-once lease/send/settlement для 32 durable jobs. Это protocol/concurrency evidence, но не подменяет внешний provider.

Ещё не закрыты target requirements этой главы: **live external provider acceptance и production-duration soak evidence для Web Push**, live paid-commerce accessibility после включения checkout/provider и полный WCAG 2.2 AA screen-reader audit. Public read-only offline cache policy теперь реализована fail-closed и намеренно остаётся узким allowlist, а не общим кешированием всех публичных страниц.

## 1. Public release quality bar

Public release target включает:

- installable PWA;
- responsive desktop/mobile UI;
- safe offline shell;
- Web Push;
- Light / Dark / System themes;
- WCAG 2.2 AA target для ключевых account/commerce flows.

Это часть release experience, а не «когда-нибудь polish».

## 2. Offline/PWA boundary

Offline допустим для:

- shell/navigation;
- cached public content where cache policy permits;
- drafts, если conflict model безопасен;
- read-only previously loaded surfaces.

Offline **не подтверждает**:

- purchase/payment;
- license activation/transfer;
- publish/moderation;
- ownership transfer;
- finance actions;
- security actions.

State-changing success показывается только после authoritative server confirmation.

## 3. Themes

Minimum theme modes:

- Light;
- Dark;
- System.

Semantic design tokens должны покрывать trust states, moderation warnings, charts, code, forms и accessibility contrast. Paid customization не должна ломать WCAG/trust identity.

## 4. Accessibility

WCAG 2.2 AA target прежде всего для:

- auth/recovery;
- cart/checkout;
- product purchase/download/license;
- support/dispute;
- publish wizard;
- server claim;
- Security Center;
- moderation/appeal communication.

Acceptance включает keyboard-only use, visible focus, logical headings, form errors, dialog focus management, reduced-motion compatibility, zoom/reflow и screen-reader semantics.

## 5. Notification channels

Release target channels:

- in-app;
- email;
- Web Push.

Telegram/Discord bots отложены.

## 6. Mandatory vs optional notifications

Пользователь не может полностью отключить сообщения, необходимые для безопасности, платежей или закона, например:

- security incident/account recovery;
- payment/refund/dispute critical state;
- license/security revocation;
- malware exposure;
- legal/terms notices where required.

Community, marketing, recommendations и promotional notifications настраиваются/отключаются.

## 7. Mobile navigation

Bottom nav:

- Home;
- Servers;
- Market;
- Community;
- More.

Messages, Notifications, Discover, Workspace/Profile и Support доступны через More/header/badges.

Password-reset security invariant: Web Push remains strictly session-bound. A successful password reset changes the password, revokes every session, cascade-deletes their web_push_subscriptions, writes the audit event and a durable security inbox notification in the same transaction. Therefore reset intentionally does not send post-commit push to revoked endpoints; the notification is available on the next login and an old device keeps no delivery capability.
