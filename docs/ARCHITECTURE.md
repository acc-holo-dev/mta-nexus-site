# Архитектура MTA NEXUS

Навигация по путям и командам: [карта проекта](PROJECT-MAP.md). Предметные контракты: [RESOURCES](RESOURCES.md), [COMMUNITY](COMMUNITY.md), [SERVERS-ORGS](SERVERS-ORGS.md), [TRUST-STAFF](TRUST-STAFF.md), [COMMERCIAL-FUTURE](COMMERCIAL-FUTURE.md). Операторские команды остаются в [OPERATIONS](OPERATIONS.md).

**DOC-05:** смысловые правила доменной модели и storage/scanner сохранены здесь и в указанных контрактах; полный текст [08-DOMAIN…](ARCHITECTURE.md) и [55-PRODUCTION-STORAGE…](ARCHITECTURE.md) не удалён (DOC-04).

## Форма системы

Модульный монолит: Next.js 16 и React 19 в `site`, PostgreSQL 18 и Drizzle в `site/packages/db`. Проект рассчитан на одну инстанцию приложения. Redis, микросервисы и внешние очереди не добавляются без подтверждённой необходимости.

## Границы

| Слой                        | Ответственность                                                                              |
| --------------------------- | -------------------------------------------------------------------------------------------- |
| `site/src/app`              | Страницы и HTTP: разбор запросов, происхождение, формирование ответа и безопасные заголовки. |
| `site/src/features/servers` | Публичный read-only Servers pilot: UI, чистые проекции и server composition.                 |
| `site/src/lib/services`     | Пользовательские операции, оркестрация и правила сценария.                                   |
| `site/packages/db`          | PostgreSQL-схемы, forward-only миграции, репозитории и транзакции.                           |
| `site/packages/domain`      | Независимые доменные типы, ошибки, правила и события.                                        |
| `site/packages/validation`  | Общие схемы входных данных.                                                                  |
| `site/packages/security`    | Авторизация, идентификаторы, сессии и ограничения запросов.                                  |
| `site/packages/storage`     | Приватное хранение и проверка целостности файлов.                                            |
| `site/packages/config`      | Проверка параметров окружения.                                                               |
| `site/packages/ui`          | Общие элементы интерфейса без импортов серверных пакетов.                                    |

Пакеты не импортируют приложение; domain не зависит от остальных пакетов. `dependency-cruiser` проверяет границы и циклы: SWC разбирает исходники, а отдельный TypeScript 6 выявляет зависимости типов. Проект компилируется TypeScript 7; поддержку его новых синтаксических конструкций анализатором нужно проверять при их использовании. HTTP-обработчик не должен становиться вторым репозиторием или обходить общие проверки.

### Servers feature pilot

`site/src/features/servers` объединяет публичный каталог и карточки. Публичный
контракт — три entrypoints: `client.ts` (клиентский UI), `server.ts` (server-only
composition страницы) и `model.ts` (чистые types/projections/pagination/cache helpers).
[Локальный контракт feature](../site/src/features/servers/README.md) фиксирует границы.

App Router сохраняет URLs/metadata/HTTP parsing/status/headers; `/servers` делегирует
feature server composition. Directory API использует чистую model entry, поэтому
не получает RSC или БД через server barrel. Существующие `serverService` и
`mtaMasterDirectoryService` остаются единственными реализациями сценариев и cache.
Claim/ownership/management/collectors не входят в пилот.

Внешний production-код обращается только к трём entrypoints. Feature не импортирует
routing; client/model не импортируют services, request locale, server entry или
infrastructure packages. Model не зависит от UI и Node builtins. Эти правила
проверяются dependency-cruiser, включая type edges; отдельный tooling suite
проверяет transitive closure реальных client/model entrypoints. Старые package/domain/
HTTP ограничения сохраняются. Новые Servers feature paths требуют полного CI.

### Resources feature

`site/src/features/resources` выделяет read-only каталог, detail, публичные versions/reviews, карточку и query model.
[Контракт feature](../site/src/features/resources/README.md) задаёт public `view`
(RSC/client-compatible карточка), `server` (server-only page) и pure `model`.
App Router сохраняет dynamic config; products API использует model и прежний service.
Services/repositories и visibility/scan/access policy остаются прежними; detail client UI,
publishing и download handlers не переносятся. Отдельный `detail-server` entry
сохраняет session/access hydration детальной страницы; metadata остаётся в routing.
`versions-server` и `reviews-server` отвечают за публичные подстраницы,
`media-server` — за author/staff media composition; их metadata
и dynamic config также остаются в routing. Все пять server entries изолированы
друг от друга и защищены `server-only`. Private imports и server leaks закрыты
анализатором и negative fixtures; реальные view/model dependencies проверяются.
Public `client` содержит gallery/Q&A, preview остаётся private; нейтральный `evidence` — provenance/package
UI; карточка остаётся в `view`. Pure gallery/provenance helpers входят в model.
Сохраняются client directives и общий modal hook; UI evidence не заменяет выдачу
по server policy. Все UI entrypoints проверяются на transitive server leaks.
Все Resources feature paths требуют полного CI.

### HTTP → service → repository

Составные изменяющие пользовательские операции идут через именованную service-команду в `site/src/lib/services` (общие правила для UI, worker и API). Пустые service-обёртки вокруг одного вызова репозитория не требуются. Авторизация и browser/mutation-адаптеры остаются на границе HTTP.

`dependency-cruiser` правило `http-handlers-use-services-for-db` запрещает новым `site/src/app/api/**` маршрутам импортировать `site/packages/db`, кроме явного списка исключений в `.dependency-cruiser.exceptions.cjs`:

| Категория           | Смысл                                                                   | Примеры                                                                                                                                                                                                   |
| ------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Allowed read/health | Простое чтение или health без оркестрации сценария                      | `api/health`, GET inbox `api/notifications/route.ts`, finance statements/scopes, support activity history, workspace server-organizations, admin commerce reconciliation GET, license check/check-release |
| Service-required    | Изменение состояния или сложная выдача; при правке переносить в service | `api/admin/actions`, mark-read/preferences/push, content/follow/reports/support/verification POST, auth context switch, product/admin build download, workspace content create                            |

Новый прямой импорт `@nexus/db` в API-маршруте вне этих списков должен падать на `pnpm analyze:architecture`. RSC-страницы (`app/**/page.tsx`) этим правилом не покрываются; для них сохраняется тот же смысловой контракт при появлении составных команд.

## Безопасность и данные

- Права проверяются по действующей сессии, текущему владельцу и членству организации. Историческое авторство не даёт постоянного доступа. Действия, требующие свежей авторизации, повторно проверяют её внутри транзакции.
- Изменяющие browser API-запросы проверяют происхождение и используют общий адаптер `withBrowserMutation`; bearer-only маршруты лицензий имеют отдельную границу. Приватные ответы не кэшируются публично.
- Доступная для скачивания сборка должна быть опубликована и иметь чистый результат сканирования, идентификатор сканера и время проверки. Скачивание повторно проверяет разрешение и целостность артефакта. Отсутствие или ошибка проверки не считаются безопасным результатом.
- Файлы приватны. Ключи генерируются приложением и не перезаписываются; локальная публикация выполняется атомарно. Размер и SHA-256 сверяются с метаданными. Аудит начала передачи не является доказательством завершённого скачивания.
- Журнал Security Center показывает действия самого аккаунта и события, где аккаунт — субъект: изменения доступа к организации (именованный участник/новый владелец), модерация лицензии владельца, рассмотрение order/support case и сообщения поддержки для заявителя, решения по verification request и server-claim. Детали аудита, идентификатор исполнителя и его сеть в этот журнал не попадают.
- Связанные изменения данных и обязательный аудит выполняются транзакционно. Пакетная выдача доступа блокирует все нужные ресурсы и права до единой проверки текущего пользователя и инициирующей сессии; последующая запись не должна снова запрашивать блокировки доступа. Повтор команды не должен создавать дубликаты или менять исходный смысл. Новые изменения схемы — только новые миграции; откат кода не откатывает БД.
- Команды коллекций отделяют подготовку от записи: все дочерние операции получают блокировки до единой проверки сессии, затем выполняются с общей транзакцией, квитанциями и аудитом. После ожидания сессии срок доступа и подтверждённый выбор версии перепроверяются по свежему времени без новых блокировок прав.
- Новая жалоба, аудит и задание доставки модераторам сохраняются одной транзакцией. Существующий push worker создаёт inbox порциями, атомарно с курсором получателей; VAPID для inbox не требуется. Повтор не сбрасывает прочитанность. Приём задания внешнего push имеет отдельную гарантию и не подтверждает его доставку.
- Новое обращение поддержки или ответ заявителя сохраняет задание доставки сотрудникам вместе с сообщением и аудитом. Worker проверяет текущую роль и создаёт inbox порциями с атомарным курсором. Уведомление содержит только общий текст и ссылку на список обращений; идентификаторы и содержание обращения не раскрываются через inbox бывшему сотруднику.
- Обычные производители inbox сохраняют намерение приёма push в той же транзакции. При `saturated`/`error` оно остаётся в `web_push_admission_recovery`; успешный приём outbox и удаление намерения атомарны. Worker повторяет приём ограниченно, проверяя прочитанность, настройки, действующие сессии устройств и исходный срок 24 часа. Уже принятый push повторно не ставится после очистки outbox. У ответов в обсуждениях сохраняется отдельный протокол receipts и адресного replay; исторический inbox без доказательства сбоя не восстанавливается автоматически.
- Каталог серверов получает данные из внешнего MTA master list. Вход ограничен по размеру, количеству и времени; устаревшие данные помечаются и не продлеваются бесконечно. Подтверждение контроля endpoint и решение модератора о владении — отдельные действия.
- Для пользовательских ссылок применяется `safeExternalWebUrl` из `site/packages/validation`. Проверка ссылки для браузера сама по себе не защищает серверные запросы от SSRF.

## Интерфейс

Используйте `@nexus/ui`, семантические токены `globals.css` и существующую локализацию. RU/EN, светлая и тёмная темы, мобильная ширина и клавиатура — части контракта. Показывайте loading, empty, error и подтверждённый success; не изображайте успешную операцию до ответа сервера.

## Доменная модель (указатель)

Ключевые сущности и связи (детали и исключения — [08-DOMAIN…](ARCHITECTURE.md)): Account/Identity; Server (master-list observation vs managed profile); Organization; Resource/Product + Build/Version + scan evidence; Library/Collection (не server pack); Content/Discussion; Notification inbox; Support/Staff case; будущие Order/License/Entitlement без активации платежей в free beta. Схемы и миграции — `site/packages/db`; факты runtime — код.

Storage/scanner/observability цели и границы production mounts — [55…](ARCHITECTURE.md) + [OPERATIONS](OPERATIONS.md); Security Center / quarantine admin — также [TRUST-STAFF](TRUST-STAFF.md) и [35…](TRUST-STAFF.md).

## Граница продукта

Закрытая бета поддерживает распространение бесплатных ресурсов. Платные покупки, реальные выплаты и production DRM не включены. Для будущих коммерческих файлов утверждены приватное объектное хранилище и подписанная доставка через CDN; текущая локальная реализация не является этим целевым решением. Утверждённые будущие решения — в [реестре](handbook/13-DECISION-REGISTER.md) и [COMMERCIAL-FUTURE](COMMERCIAL-FUTURE.md); текущую реализацию проверяйте в коде.

## Проверка изменений

Поведение и пограничные случаи проверяются unit/HTTP-тестами; транзакции и конкуренция — отдельной PostgreSQL БД; пользовательские пути — браузерными тестами. Инфраструктурные изменения и релиз требуют полного соответствующего CI. Подробные команды: [эксплуатация](OPERATIONS.md). Оставшиеся пробелы: [проблемы](PROBLEMS.md).
