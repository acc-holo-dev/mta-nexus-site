# FLOWS — пользовательские сценарии и контракты результатов

**Интегрировано DOC-02; authoritative сценарии после DOC-05.** Основание — код `385e577e7443cf7d7b817419ce5c3b8afe87b690`, 1.2.0-beta.3. Предметные правила — в [RESOURCES](RESOURCES.md) / [COMMUNITY](COMMUNITY.md) / [SERVERS-ORGS](SERVERS-ORGS.md) / [TRUST-STAFF](TRUST-STAFF.md) / [COMMERCIAL-FUTURE](COMMERCIAL-FUTURE.md); UI — [UX-CONTRACT](UX-CONTRACT.md); ops — [OPERATIONS](OPERATIONS.md). Этот файл не означает внедрение, новый PASS или разрешение внешних действий. Задачи: [tasks.json](../planning/tasks.json).

## 1. Общий контракт действия

Пользователь должен понимать объект, результат и следующий шаг. Подтверждение интерфейса следует за проверенным ответом сервера. Успешную запись нельзя отменять сообщением «не удалось сохранить» только из-за сбоя последующего чтения списка.

| Состояние | Требование |
|---|---|
| Первое чтение | Loading; unknown не превращается в false, zero или empty. |
| Pending mutation | Одно намерение, сохранённые payload/revision/draft; повтор не меняет смысл запроса. |
| Success | Проверены object identity, receipt/revision и фактическое состояние; связанные представления обновлены. |
| 400 | Исправляемая ошибка полей без потери ввода. |
| 401 | Вход с безопасным возвратом, затем перечитывание прав и явное завершение действия. |
| 403/404 | Допустимое объяснение и следующий шаг; не раскрывать существование чужого закрытого объекта. |
| 409 | Перечитать актуальное состояние, сохранить локальный текст, не перезаписать чужое изменение. |
| 429 | Временное ограничение с известной серверу рекомендацией; без автоспама запросов. |
| Timeout | «Не удалось подтвердить»; сверка или повтор по поддержанному idempotency protocol. |

Удалённое, заблокированное и невидимое не всегда можно различить публично. Снятие своей сохранённой связи допустимо даже при недоступном target; новое действие с ним требует текущей проверки доступа. Эти правила дополняют существующие guards и revision checks, а не заменяют их клиентским состоянием.

## 2. Гость → ресурс → вход → получение

**Сейчас:** бесплатный ресурс ведёт в `/acquire?productId=…`; claim корректно требует сессию, но ошибка не предлагает контекстного восстановления. AuthForm после успеха всегда открывает `/workspace`. Это подтверждённый разрыв F01.

**Цель FLOW-01:** единый внутренний return target, включая разрешённые query/hash; login и registration возвращают к тому же намерению. Внешние redirect targets не принимаются. Полная смена document после auth сохраняется, чтобы не переиспользовать cache предыдущего аккаунта. После входа повторно читаются права, существование объекта и уже выполненное состояние. Запись, реакция или скачивание не запускаются автоматически.

«Открыть библиотеку» должно вести в библиотеку. Потерянный комментарий требует отдельного draft/intent-контракта FLOW-10. Основание: [AuthForm](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/auth-form.tsx#L44-L60), [acquire](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/acquire/page.tsx#L83-L114).

## 3. Сохранение и четыре разных вида интереса

| Действие | Текущий и предлагаемый смысл |
|---|---|
| **Сохранить ресурс** | Существующий product-follow помещает ссылку в saved; release watch не включается. FLOW-02 уточняет подпись и добавляет вход на detail. |
| **Следить за ресурсом** | Отдельное значение возможно при появлении определённой ленты событий ресурса. Сейчас не обещать такую ленту на основании одной follows-записи. |
| **Уведомлять о новых версиях** | Существующий release watch: будущие одобренные версии при текущем доступе. |
| **Следить за обсуждением** | Существующий content-follow: новые комментарии конкретной публикации. |

Тихая закладка **публикации**, независимая от discussion follow, — предложение FLOW-06. Миграция не должна молча менять намерение прежних подписчиков. В интерфейсе не нужны четыре одинаковые кнопки: сегодня достаточно «Сохранить» и «Уведомлять о новых версиях» на ресурсе, отдельного control у обсуждения.

User/org/server follow имеют разные эффекты и подписи; self-user follow запрещён. Сохранение недоступного объекта остаётся управляемой ссылкой без закрытых metadata. Основание: [follow repository](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/repositories/follow-workspace.ts#L418-L524), [discovery actions](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/discovery-directory.tsx#L189-L221).

## 4. Release watch: включённая связь и эффективная доставка

**Сейчас:** watch доступен в библиотеке. Enable требует current download access, published resource и safe published build. Пределы — 100 активных на аккаунт, batch 20. Resume начинает с будущих событий; pinned selection и файлы пользователя не меняются.

Доставка использует `commerceEnabled`, в settings — «Активность ресурсов». Если категория выключена, worker пропускает событие и продвигает sequence. Последующее включение не догоняет backlog. При потере доступа watch может отключиться.

**FLOW-03/09:** на detail показать отдельные состояния «включено», «категория выключена», «нет доступа», «нет допустимой сборки», «лимит», «конфликт». Ссылка ведёт к соответствующей настройке. Batch подтверждает per-item result; unknown outcome не становится общим success. «Коммерческие уведомления» в help заменить согласованным ресурсным названием. Основание: [watch command](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/repositories/resource-release-watches.ts#L119-L174), [worker](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/repositories/resource-release-worker.ts#L117-L190).

## 5. Discussion follow, прямой ответ и mute

**Сейчас:** followed-publication notice использует `follow/followsEnabled`. Автор публикации и автор родительского комментария могут получать direct notice через `content/contentEnabled`. Причины дедуплицируются; self-notice исключён. Поэтому unfollow не обещает тишины автору.

**FLOW-04:** объяснять причину получения и точный эффект отписки. **FLOW-05 — предложение:** object mute/snooze сохраняет саму связь, но подавляет выбранный объект. До реализации нужны решения о сроке, direct/follow precedence, backlog и исключениях security events. Нельзя реализовать mute как скрытое выключение категории всего аккаунта. Основание: [recipient/category selection](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/repositories/notifications.ts#L429-L475), [current schema](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/schema.ts#L1251-L1269).

## 6. Inbox и браузерный канал

Центр уведомлений, фильтры, read/unread, expectedIsRead и batch до 25 уже реализованы. FLOW-08 отделяет первое чтение bell от empty и согласует read-policy: открытие popover не делает все записи прочитанными. Действие account-wide «прочитать все» отличается от шести видимых уведомлений и выбранных строк.

**UI01 принадлежит UX-треку:** вкладка Unread должна менять реальную URL-выборку; второй локальный фильтр здесь не создаётся.

Web Push — канал текущего браузера. Unsupported, unconfigured, denied и error требуют разных пояснений. Browser permission запрашивается только по явному действию. Выключение push не удаляет inbox; category off может не создать запись вообще. Пять preferences не управляют security category. Основание: [bell](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/notification-bell.tsx#L21-L100), [category gate](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/repositories/notifications.ts#L341-L390), [push settings](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/web-push-settings.tsx#L100-L152).

## 7. Комментарии, ссылки и неопределённая отправка

Reply, search, paging, permalink, edit/delete уже есть. Автор меняет свой текст; модератор удаляет чужой с причиной, но не переписывает его. Удаление parent сохраняет ответы. FLOW-11 сохраняет draft при конфликте, объясняет недоступную permalink-цель и позволяет вернуться к общей дискуссии.

**FLOW-10:** controlled repro (вне production): commit comment + drop HTTP response, затем повтор того же намерения без протокола создавал бы второй ID/fanout. Реализация без нового SQL: клиент замораживает UUIDv4 `Idempotency-Key`; сервер пишет его как `comments.id` (`cmt_` + hex). Повтор того же ключа и payload возвращает тот же comment (`replayed`) без второго fanout; mismatch → `COMMENT_IDEMPOTENCY_CONFLICT`; новый ключ с тем же текстом допустим. Concurrent-click guard и guest draft (React state, без auto-publish после входа) сохраняются. Text 2–5000 и создание 20/5 минут без изменений. Production-дубль по-прежнему не заявляется.

Resource Q&A с build context — отдельное предложение FLOW-12, не готовый article discussion. Вопрос не меняет rating и не публикует закрытый support. Основание: [create client](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/lib/content-comment-client.ts#L26-L58), [new comment ID](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/lib/services/content-service.ts#L170-L188), [management rights](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/repositories/discussion-management.ts#L113-L185).

## 8. Версии и скачивание

**Сейчас:** public download без buildId выбирает latest; library versions передаёт selected buildId с учётом fixed/latest. Это разные запросы, а не потеря закрепления.

**FLOW-17:** показывать «Скачать последнюю vX» и выбранную vY до клика. Недоступный fixed build не подменять молча. Progress, cancel, metadata/hash verification и receipts сохраняются. Success означает подтверждённую передачу браузеру, не установку или запись на диск. Квитанция связывает дальнейшее support-обращение с фактическим build.

**FLOW-21:** final gates после длительной подготовки должны повторно проверить initiating session. Current rights/build checks остаются. Controlled revoke/expiry test выполняется вне production; уже переданные байты нельзя отозвать. Основание: [download selection](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/api/products/[id]/download/route.ts#L99-L152), [selected library build](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/workspace/library/[id]/versions/page.tsx#L62-L93).

## 9. Коллекции, discovery, профиль и сервер

FLOW-07 использует существующие приватные коллекции: 30 collections, 200 items, batch20. Добавление в коллекцию не включает watch, архивирование коллекции не отзывает доступ. Public/shared collections не подразумеваются.

FLOW-14 сохраняет URL-контекст поиска и Back, отделяет empty от failure. FLOW-15 объясняет два privacy toggle — activity и professional contacts — и guest preview; это не полный private account. FLOW-16 называет protocol action «Открыть в MTA», даёт copy/manual fallback и не считает клик подтверждением игры.

Реакции FLOW-13 остаются one-of-three с дедупликацией notice; переключение не даёт очки. Основание: [collection limits](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/domain/src/library-collections.ts#L1-L46), [privacy](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/repositories/profile-privacy.ts#L41-L78), [server connect](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/servers/[slug]/page.tsx#L193-L199).

## 10. Отзывы, support и lifecycle

FLOW-18 показывает точные review denials. Resource review требует доступа и исключает автора/управляющих; server review требует active/public + follow и исключает владельца. Эти основания не доказывают установку или игровую сессию. Removed и withdrawn различаются; stale revision не перетирает новую запись.

Support уже приватен и idempotent. FLOW-19 добавляет проверенный resource/build/receipt context. Requester может open↔resolved; closed управляет staff. Ответ в resolved вновь открывает case. Пределы 5 новых/час и 30 replies/час сохраняются. Timeout сохраняет намерение, closed предлагает разрешённый следующий путь. Основание: [support status gate](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/repositories/support.ts#L612-L650).

FLOW-20 показывает resource status, build status и следующий разрешённый шаг. Restore archived и release suspended возвращают draft, а не published. FLOW-22 применяет уже действующее правило staff_action→current_password в реальном HTTP→transaction пути существующих критичных команд. Минимальное прямое подтверждение паролем не требует ожидания нового TTL/capability-token решения; текущие password hash, session, role и revision проверяются до применения. Расширение policy и неописанный passwordless staff path — отдельный scope. Добровольная 2FA остаётся отдельной возможностью. Основание: [lifecycle](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/domain/src/resource-commerce.ts#L19-L29), [fresh policy](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/security/src/fresh-auth-policy.ts#L22-L38), [admin actions](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/api/admin/actions/route.ts#L68-L98).

## 11. Границы эффективности и доказательств

Проверять завершённый полезный сценарий: человек нашёл сохранённое, осознанно выбрал версию, получил ответ, изменил статус своего кейса. Login, click, push-provider acceptance и открытие страницы не доказывают этот результат. Количество повторов или реакций не превращать в очки и удержание автоматически.

Новые mute/bookmark/Q&A сначала проходят decision и ограниченный pilot с заранее определёнными полезными действиями и операционной нагрузкой. Здесь нет заявленных uplift, ROI или гарантии retention. Все перечисленные проверки — требования к будущей работе; в подготовке пакета runtime, БД, сообщения и production не изменялись.

