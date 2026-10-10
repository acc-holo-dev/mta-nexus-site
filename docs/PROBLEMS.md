# PROBLEMS — реестр открытых проблем MTA NEXUS

Единственный реестр проблем проекта. Обновлён: 2026-10-09 (после атомарного счётчика просмотров и ограничения нагрузки рассылки; текущий hosted-runner blocker зафиксирован ниже).

Правила реестра:

- каждая проблема имеет приоритет, описание, доказательство и следующий шаг;
- закрытая проблема удаляется из реестра в том же коммите, который её закрыл
  (история — в commit messages и CI evidence);
- проблемы не дублируются в других документах; OPERATIONS ссылается сюда.

Приоритеты: `P0` — блокер релиза, `P1` — существенная проблема качества,
`P2` — известное ограничение, требующее работы, `P3` — улучшение/гигиена.

---

## P0 — блокеры релиза

На `a7d6080` успешно завершились CI, Account browser,
Directory browser и Resource browser. Подтверждены production/local Docker,
PostgreSQL persistence, восстановление бэкапа, полный Verify и production mail
worker (TLS, аварийный перезапуск, штатное завершение и отказ без ключа).
Это проверка одноразового CI-стека, а не существующей production-инфраструктуры.
Обязательные status checks пока не настроены.

## P1 — существенные проблемы

### P1-1. Приёмка на целевой инфраструктуре

CI переработан: один workflow-координатор, отдельные параллельные unit и
последовательные database проекты, один кешируемый production-образ на SHA.
Быстрый контур включает оба тестовых проекта и короткий браузерный smoke;
полная приёмка запускается явно/по релизному тегу/при изменении инфраструктуры.
Пропущенный обязательный шаг не считается успешной приёмкой. Полный новый
контур успешно прошёл на `fde2721`: 930 unit и 203 database проверки, 109
Node-проверок, production/local Compose, SMTP worker и все браузерные сценарии.
На том SHA все 239 существовавших Vitest-файлов были распределены без пропусков и пересечений; текущий классификатор проверяет полный автоматически обнаруженный набор. Быстрый контур
подтверждён на `7a9539e`: оба тестовых проекта, tooling и production browser smoke
зелёные; тяжёлые инфраструктурные и полные браузерные задания пропущены.
В этом прогоне обнаружена и исправлена first-use гонка recovery rate-limit:
параллельные запросы теперь сериализуются по keyed digest до чтения окна. Production-образ
собирается один раз; обычное изменение приложения требует шесть заданий вместо
прежних девяти. Локально unit проходят за ~12 секунд; на GitHub их время зависит
от runner. На `c06da2e` `biome lint --max-diagnostics=200 .` и `tsc -b`
прошли без lint-диагностик; unit/tooling, sequential database tests,
exact-SHA production image и production browser smoke также зелёные.
Флейк recovery-теста account-mail worker устранён корректным IPC handoff с
ожиданием callback отправки lease, а не увеличением таймаута.
Локально PostgreSQL и Docker недоступны; интеграционные результаты берутся из CI.

Живая приёмка больших портфолио закрыта: Chromium проверяет разработчика,
пользователя и организацию с 125 безопасными ресурсами и 25 статьями,
RU/EN, ширины 390/1280 px, страницы за первыми 100 ресурсами, одинаковые
даты, устаревшие ссылки, исключение чужих/черновых/платных/небезопасных
записей и независимость resource/article пагинации. Сохранены скриншоты.
Полный Verify вызывает настоящие репозитории на временных таблицах с
10 128 ресурсами и 10 025 статьями, проверяет выбранные индексы и сохраняет
EXPLAIN ANALYZE/BUFFERS до и после миграции 0026.

**Следующий шаг:** проверить планы запросов, память/диск и критические сценарии
на восстановленной копии целевой БД. Синтетический CI-набор и Chromium не
подтверждают production-нагрузку или совместимость остальных браузеров.


### P1-2. GitHub-hosted runner не начинает `plan` job

Добавлен приватный список управления серверами с пагинацией, поиском,
фильтрами и организационными полномочиями. Обзор запрашивает четыре карточки
и точный total, вместо полной выборки owner-строк. Live-метрики относятся к
показанным карточкам; неизвестные counts не превращаются в нули. SQL-builder
и SSR проверки дополнены PostgreSQL fixture на 135 доступных серверах и
исключённых организационных правах. Её реальное исполнение, планы запросов
и браузерная приёмка остаются открытыми; новая миграция не требуется.
После совмещения с архивом версий ресурсов локальный `pnpm check:code`
прошёл 1658 unit и 201 tooling проверку, typecheck, Knip и архитектурный
анализ. Lint сохранил 40 предупреждений. Удалены два неиспользуемых
реэкспорта release-pagination helpers из web-модуля; прямые domain API сохранены.

История серверов теперь агрегирует весь выбранный период 24h/7d/30d, а не
только последние 500 записей. Сводка и UTC-интервалы графика читаются вместе с
ограниченными подробными записями в read-only repeatable-read транзакции.
Это исправляет пропущенные старые пики и неполные счётчики; три SELECT добавляют
работу БД, production latency ещё не измерена. Пропуски не считаются offline.
SQL-builder, HTTP, сервисные и SSR проверки дополнены PostgreSQL fixture с
более чем 500 наблюдениями; её реальная DB приёмка остаётся открытой.
После совмещения с библиотекой ресурсов и миграцией 0036 прошёл полный
`pnpm check:code`: 1591 unit и 200 tooling проверок, typecheck, Knip и
архитектурная проверка. Lint сохранил 40 предупреждений. Устранена случайная
ошибка VAPID fixtures: тестовые scalar keys дополнены до 32 байт без изменения
рабочей криптографии. Эти результаты не заменяют PostgreSQL/browser приёмку.

Подготовлен единый credential-free SQL projection для пользователей и
узкий session identity lookup: account/profile/context запросы не читают
password_hash, identity не читает private session metadata. Legacy lookup и
password revalidation под lock сохранены. Некорректный/non-finite expiry
отклоняется. SQL-builder и row-mapper проверки не заменяют PostgreSQL/browser
приёмку; она остаётся заблокирована hosted runner.
Срез совмещён с параллельными изменениями read-only commerce history и правкой
landmark accessibility. Восстановлены актуальный anonymous-page контракт,
типобезопасный currency formatter и проверки неиспользуемого кода.
Локально прошли 1534 unit и 200 tooling проверок; реальная DB приёмка остаётся открытой.

Последний проверенный CI для `d4be469` (run `37914732835`) снова завершился
до выполнения шагов: `plan` failure, steps=0, runner_id=0; DB job skipped.
Причина отказа hosted runner по доступным данным не установлена.
Проверка ресурсных прав теперь читает ID вместо полной entitlement-строки,
permissions вместо полной лицензии, а claim preflight — только status/price.
Drizzle/pg-proxy покрывает прежние фильтры доступа и последовательность claim;
настоящая PostgreSQL-приёмка остаётся открытой до восстановления CI.
Локальный срез прошёл 1488 unit и 200 tooling проверок, typecheck, Knip
и архитектурный анализ; lint сохранил 40 предупреждений.

Страница Security и HTTP API сессий/Web Push больше не читают одну
session/user запись дважды для пользователя и ID текущей сессии.
`getSessionIdentity` возвращает их из одного validated lookup без кеша между
запросами. Проверки текущего actor под блокировкой при отзыве сессий сохранены.
Drizzle/pg-proxy, HTTP и SSR проверки покрывают expiry, missing/revoked rows,
приватность и ранний отказ Web Push; настоящая DB/browser приёмка остаётся открытой.
Локальный `pnpm check:code` на этом срезе прошёл 1452 unit и 200 tooling
проверок, typecheck, Knip и архитектурный анализ; lint сохранил 40 предупреждений.

На saved-странице чтение ресурсов больше не задерживает MTA lookup после
получения публичных серверов. Проверки подписки и отметки уведомления возвращают
только ID вместо полной строки. SSR virtual-clock и Drizzle/pg-proxy тесты
проверяют порядок операций, фильтрацию, fallback, SQL и boolean-результаты;
реальная production-задержка и PostgreSQL execution этими тестами не измерены.
Этот срез локально прошёл `pnpm check:code`: 1440 unit и 188 tooling проверок,
typecheck, Knip и архитектурный анализ; lint сохранил 40 предупреждений.

Счётчик просмотров статьи теперь увеличивается в SQL и получает значение
через RETURNING. Рассылка уведомлений ограничена десятью операциями на вызов,
считает результаты по партиям и продолжает обработку после синхронных и
асинхронных ошибок отдельных получателей. Локальные проверки этих изменений
используют моки; конкуренция настоящего PostgreSQL и нагрузка нескольких
одновременных рассылок ещё требуют отдельной приёмки. Подробности и команда
проверки описаны в OPERATIONS, раздел Code analysis.

После совмещения с новыми коммитами устранены локальные ошибки типов и устаревшие
тестовые контракты history/cache/session. Upgrade rehearsal обновлён до 0034:
добавлены существующий сервер и legacy challenge, проверки revision defaults
и constraints. Его реальное исполнение на PostgreSQL ещё не подтверждено.
Совмещённое дерево локально прошло `pnpm check:code`: 1434 unit и 188 tooling
проверок, typecheck, Knip и архитектурный анализ. Lint завершился с 40
предупреждениями; это не чистый lint и не hosted CI/PostgreSQL-приёмка.

2026-10-09: наблюдения старых endpoint больше не сохраняются в
историю нового IP/порта, включая случай A -> B -> A. При записи collector
сравнивает исходный адрес и `endpointRevision` под `SELECT FOR UPDATE`
до INSERT и возвращает null при несоответствии;
диагностика считает `recordSkippedEndpointChanges`. Механизм усиливает
согласованность истории и live-данных, но добавляет один locking SELECT
на наблюдение; реальный PostgreSQL throughput/latency и race acceptance
нужно проверить после восстановления CI.



2026-10-09: оптимизирован bounded collector: добавлен постраничный
keyset-обход по id, CLI `NEXUS_SERVER_OBSERVATION_MAX_PAGES` и
`NEXUS_SERVER_OBSERVATION_AFTER_ID`, выходной `nextCursor`.
Для многостраничного CLI пишется безопасный checkpoint на stderr после
каждой полностью завершённой страницы; при сбое следующей страницы
оператор может продолжить без потери известного прогресса.
Теперь можно продолжить после первых 500 серверов без перезапуска
обхода с начала. Фиксированное число страниц ограничивает нагрузку.
Стабильность выборки между отдельными запусками при параллельных
изменениях требует отдельной приёмки; текущий CI блокер остаётся.



2026-10-09: добавлена защита MTA claim proof через `endpointRevision`
и миграцию 0034: issue/consume/moderation проверяют ревизию
сетевого адреса, при смене IP/порта сбрасывается `isVerified`.
Редакционные правки не сбрасывают подтверждение. Старые proof с NULL
revision не принимаются; до перевыпуска нужно отклонить старый pending.
PostgreSQL CI и миграционная приёмка остаются обязательными.



2026-10-09: исправлены конкурентные операции при изменении IP/порта
серверной карточки. Условный PostgreSQL UPDATE сбрасывает старые
live-метрики при изменении endpoint, а запись наблюдений проверяет
endpoint, который был считан сборщиком. Тесты PostgreSQL добавлены,
полное выполнение заблокировано отсутствием hosted runner.



Доступные методы истории наблюдений `listRecent`, `listWindow` и
`getPeakPlayers` теперь устойчивы к NaN/Infinity: лимиты и интервалы
получают безопасные значения по умолчанию до построения SQL. Прежние
числовые ограничения сохраняются; добавлены контрактные проверки граничных
значений и дат. Их выполнение в текущем CI ещё не подтверждено.

MTA master-list fetch отказывается от редиректов (`redirect: "error"`) и
отсекает `response.redirected` даже при injected HTTP adapter. Так mirror
не может перенаправить доверенный HTTPS endpoint на иной адрес или протокол
через штатный Fetch redirect. Добавлены два теста fallback/error semantics.
В PostgreSQL-выборках истории серверов tie-breaker по ID делает выдачу
детерминированной при одинаковом `observed_at`. Дополнительные SQL unit
tests проверяют сортировку, предел 500 и последовательность результатов.
До полноценного CI/PostgreSQL их прохождение не подтверждено.


API каталога MTA без фильтров читает только нужную страницу; при фильтрации
считает все совпадения, сохраняя только страницу до 100 ссылок на серверы.
Fixture из 10 000 серверов показала 50 чтений вместо 10 000 для страницы
из 50 записей. Последующие текстовые запросы по одному неизменяемому снимку
каталога повторно используют нормализованные строки через WeakMap; на новую
версию снимка создаётся отдельный ленивый индекс, который может быть собран GC.
Фильтр только по числу игроков и выдача без фильтра индекс не создают.
При stale fallback каталог теперь выставляет HTTP `Cache-Control: no-store`,
чтобы публичный SWR-кеш не продлевал срок устаревшего master-list.
ASE reader также использует один UTF-8 декодер на снимок вместо декодера
для каждого поля. Регрессионные тесты добавлены; точное измерение
production latency и память под нагрузкой всё ещё требуют внешней приёмки. Вкладка серверов `/discover` использует общий endpoint index
для нескольких карточек: 12 отсутствующих результатов требуют 10 000 чтений
адресов вместо 120 000. Сохранены Unicode/joined-field поиск, точные totals,
порядок, первые дубли, раннее одиночное совпадение и stale/failure отображение.
Общий endpoint index строится постепенно, сохраняя просмотренную часть:
двенадцать ранних совпадений требуют только двенадцати чтений. Остальные
потребители helper также получают это поведение без изменения API; снимок
не должен изменяться во время использования lookup. Новые проверки включают
2000 generated comparisons пагинации на двух seeds, 1000 сравнений index
с первым `Array.find` и SSR настоящих карточек с synthetic service adapters.
Локальный `check:code` прошёл 1328 unit, 178 tooling, typecheck, lint, Knip
и архитектурную проверку.
Production latency/heap и живая browser приёмка этими проверками не подтверждены.

Страница деталей MTA-сервера теперь передаёт уже загруженную запись в
`serverHistoryService.getHistoryForServer` и не дублирует lookup по ID
перед выборкой истории. Вариант `getHistory(id, window)` для публичного
history API сохранён, оба пути проверяют private visibility. Добавлены
три unit behavior cases с repository mock. Это уменьшение на один SELECT
при SSR страницы с историей, не измерение полной задержки страницы.

Запись наблюдений теперь обновляет агрегированные live-поля сервера только
если время нового наблюдения строго больше сохранённого (или прежней отметки
нет). Старая или одновременная по timestamp запись остаётся в истории, но
не затирает более свежие currentPlayers/maxPlayers/source. Предикат выполняется
в одном PostgreSQL UPDATE после вставки с onConflictDoNothing, без
прикладного read-before-write или новой миграции. Добавлены real-DB
integration cases: older-after-newer, equal timestamp, duplicate и
конкурентная запись; до исполняемого database CI они не считаются пройденными.

Публичный `GET /api/servers` теперь читает редакционные данные и master-list
одновременно (upstream failure не ломает выдачу), а для нескольких
редакционных карточек использует инкрементальный endpoint index вместо
повторного Array.find на весь master-list. При 60 отсутствующих совпадениях
на synthetic 10k-снимке число индексных чтений сокращается с 600k до 10k
(проверяется единичным proxy instrumentation). Ответ с unavailable или
stale upstream больше не сохраняется в публичном HTTP/SWR-кеше; у
достоверно свежего upstream прежний короткий кеш сохранён. Добавлены
unit HTTP tests, а оценка production latency остаётся непроверенной.

Выборка известных серверов для MTA observation collector теперь возвращает
только id/ipAddress/port вместо полного редакционного профиля с JSON
метаданными. Выборка сохраняет фильтры active/non-private, лимит 501
(включая overflow sentinel) и стабильный порядок updatedAt DESC, id DESC.
Контракт проверяется unit-тестами построения Drizzle SQL; нагрузочный замер
PostgreSQL остаётся задачей целевой приёмки.

Сборщик наблюдений запускает два независимых чтения одновременно и сохраняет
совпадения партиями до пяти параллельных записей. При ошибке он дожидается всех
начатых операций до закрытия соединения CLI и не запускает следующие партии;
уже завершённые транзакции могут сохраниться. Существующие ограничения среды,
лимит 500 и repository transaction/duplicate semantics не изменены.
Одиннадцать новых проверок используют synthetic repositories и настоящие
endpoint helpers; fixture из 500 записей занимает 100 виртуальных тактов вместо
500 при ограничении в пять операций. Локальный `check:code` прошёл 1310 unit,
178 tooling, typecheck, lint, Knip и архитектурную проверку. Это подтверждает
порядок выполнения и завершение операций при отказе, а не реальную пропускную
способность PostgreSQL или DB/browser приёмку.

Карточка ресурса одновременно запускает независимые чтения после успешного
preview; история сборок остаётся зависимой от текущего management decision.
Locale/session и public metadata/locale также стартуют вместе. Одиннадцать
проверок acquisition/page behavior используют удерживаемые Promise и SSR с
synthetic service adapters; проверены оба решения управления, отказ прав,
поздняя ошибка entitlement и отсутствие detail reads после denied preview.
Локальный `check:code` прошёл 1299 unit и 178 tooling, typecheck, lint, Knip
и архитектуру. Это подтверждение порядка запуска и UI, а не измерение
production SQL latency или живая DB/browser приёмка.

Глобальный поиск использует общий endpoint index для нескольких серверных
результатов, сборщик наблюдений также повторно использует этот helper.
Fixture с 10 000 наблюдений и 50 отсутствующими серверами показала сокращение
чтений адресов с 500 000 до 10 000; одиночный ранний match сохраняет прямой
поиск. Все 32 целевые проверки прошли. Полный локальный `check:code` прошёл
1293 unit и 178 tooling, typecheck, lint, Knip и архитектуру. Это проверка
количества операций и поведения с synthetic sources, а не production latency,
памяти под нагрузкой или DB/browser acceptance.

Контексты аккаунта читают выбранные организации участника одним `IN` запросом
с тремя колонками вместо до 50 поштучных чтений. Сохранены owner priority,
роли, исходный порядок членств, лимит, private headers и personal fallback.
Локальный `check:code` прошёл 1289 unit и 178 tooling, typecheck, lint, Knip
и архитектуру. Десять HTTP проверок и три проверки SQL/row mapping на настоящем
Drizzle builder с proxy driver не требуют БД. Интеграционный owner/revocation
сценарий дополнен проверкой доступного membership context, но PostgreSQL
локально недоступен; выполнение этой проверки и DB latency не подтверждены.

Polling колокольчика теперь выполняет последовательные чтения и отменяет
запрос при hidden/cleanup; запоздавший ответ не перезаписывает свежий UI.
Во время mark-all-read фоновое чтение приостановлено до повторной сверки
с сервером. Применён существующий private API helper, без новых зависимостей.
Локальный `check:code` прошёл 1281 unit и 178 tooling, typecheck, lint, Knip
и архитектуру. Новые проверки используют fake timers и SSR effect adapter;
три регрессии воспроизведены до исправления. Это проверка lifecycle запросов,
а не живая DOM/browser приёмка или production замер экономии трафика.

Публичные profile/server metadata и страницы теперь разделяют одно чтение
записи в рамках RSC-запроса, locale также мемоизирован на время запроса.
Реальный RSC renderer development/production прошёл 40 synthetic renders с
параллельными RU/EN запросами, повторным запросом и missing → created.
Локальный `check:code` прошёл 1266 unit и все проверки кода; полный tooling
набор после добавления обоих RSC режимов содержит 178 успешных тестов.
Это подтверждает дедупликацию при синтетических репозиториях, а не реальные
DB-тайминги или приёмку production Docker/browser.

Локальный и CI unit-контуры теперь используют `pnpm check:code`: шесть
проверок выполняются последовательно, ошибки собираются за один запуск с
ненулевым итоговым статусом. Команда прошла локально: 1266 unit и 176 tooling,
lint, typecheck, Knip и архитектура. Ручной tokenizer тестовых импортов заменён
уже установленным SWC; семь новых fixture-проверок покрывают типы, templates,
typed mocks, computed importActual/unmock, partial mocks, CommonJS и отказ при
невалидном синтаксисе. Все 287 Vitest-файлов сохранили свои группы: 219 unit,
68 database. Эти проверки не подтверждают выполнение DB/browser/Compose.

Последующий browser-toolchain/fast-check slice объединил пять установок
браузерных инструментов в один источник версий. Реальная npm-установка профиля
`a11y` локально прошла. Также прошли 1266 unit, 169 tooling, frozen install,
typecheck, lint, Knip и архитектурная проверка. Четыре proxy/IP свойства проверены
по 1000 примеров на двух seed; найденный UTF-8 length exception воспроизведён
до исправления и устранён с регрессионной проверкой настоящих Fetch Headers.
Это самостоятельные проверки установки/защитного кода, а не выполнение
production Docker или browser acceptance.

В browser smoke и resource-browser добавлены axe-проверки WCAG для форм,
диалогов и авторизованных состояний RU/EN. Само падение gate при нарушениях и
сохранение диагностик проверяются отдельными Node-тестами с browser-adapter
fixture. Настоящий browser scan в текущей локальной среде не выполнен:
обычный Chromium не установился, альтернативный локальный binary не запускается.
До executable CI нет подтверждения axe baseline на production-образе;
найденные там нарушения нужно исправить, а не скрывать правилами/исключениями.

DEV Mailpit overlay добавлен в `Local Docker startup`: приёмка проверяет
worker health, непубликуемый SMTP, loopback UI и фактический TLS SMTP/API capture.
Локально прошли typecheck, lint, Knip, архитектурная проверка, 1261 unit,
163 tooling и 26 runtime/dispatcher тестов. Tooling включает настоящий TLS
handshake с генерируемым сертификатом и отказ при неверном hostname.
Docker в среде этой проверки недоступен; новая Compose-приёмка пока не выполнена.
Это не закрывает существующий hosted-runner blocker или production rollout.

После исправлений Web Push commit `0221f85` и все проверенные последующие
SHA получают один и тот же внешний симптом: job **Choose verification scope**
завершается `failure` до первого шага. GitHub Actions Jobs API возвращает
`steps: []`, `runner_id: 0`, пустые `runner_name` / `runner_group_name`;
job logs отсутствуют. Check Run при этом создаётся и содержит системные
annotations, то есть workflow зарегистрирован, но runner не назначается.

У run `37565630603` zero-step failure воспроизведён в трёх attempts, включая
отдельный rerun конкретного failed job. Симптом далее стабильно повторяется на
новых push-runs. Свежий run `37719493537` на `cab1c78` завершился тем же
образом: plan job `113123622340` имеет `runner_id: null` и `steps: 0`;
все executable jobs были пропущены до checkout/user code. Это подтверждает, что blocker пережил
durable Web Push queue alerting и safe public offline-cache refactor и не
привязан к конкретному workflow step. При этом последний полностью исполнившийся HEAD `7567191`
прошёл полный CI, а run `37565299572` на `3a1f818` ещё назначал runners,
запускал реальные jobs и дал обычные диагностируемые ошибки
typecheck/upgrade rehearsal.

Репозиторий private. Доступный GitHub connector не раскрывает account billing /
Actions minutes / repository Actions policy, поэтому причина (quota/billing,
repository policy или runner-side allocation failure) **не подтверждена**.
Публичный GitHub Status на момент диагностики показывал Actions operational,
так что глобальный outage также не подтверждён.

На `93604f1` run `37910773256` и plan job `113755107097` повторили failure
с пустыми steps. Check Run зарегистрировал две annotations, но текущий
connector отклоняет endpoint их чтения; job logs вернули BlobNotFound.
Точное системное сообщение поэтому ещё не прочитано. Добавлена read-only
команда `pnpm ci:diagnose --run-id 37910773256`: при локальном токене с
Actions/Checks read она собирает attempt-specific jobs и системные annotations,
не меняя settings и не перезапуская CI. Команда покрыта synthetic API tests;
live authenticated REST-запуск в этой среде не выполнен.

- **Влияние:** commits после `7567191` пока не получили executable exact-SHA
  CI, даже когда их ошибки проверены статически/математически.
- **Следующий шаг:** прочитать системные annotations через `pnpm ci:diagnose`,
  затем проверить GitHub Settings → Actions и Billing/usage для
  private repo/account; после восстановления hosted runner запустить полный CI
  на актуальном HEAD и закрыть этот пункт только после реального выполнения
  `plan`, unit/typecheck, migrations, Docker и browser acceptance.


### P1-3. Release upgrade fixture отставал от Web Push outbox

Upgrade rehearsal раньше отставал от Web Push outbox. Сейчас release contract
намеренно требует, чтобы target совпадал с последней migration journal entry.
После добавления Support idempotency target обновлён до
`0033_support_mutation_idempotency`: rehearsal проверяет Support tables,
все read-path индексы (requester, status, category+status, global staff order),
message-history index, Web Push subscriptions, outbox/gate/indexes,
rollback/retry, legacy rows и idempotency. Любая новая migration снова
заставит fixture fail-fast до review.

- **Статус:** исправлено в коде, но exact-SHA hosted CI всё ещё нужен после
  восстановления runner allocation.

### P1-4. Web Push external acceptance ещё не выполнена

Durable Web Push runtime, worker recovery, stale-subscription lease ownership, local TLS/SNI provider harness,
`Retry-After`, anti-SSRF, queue health/watchdog (включая корректный alert при ровно 100% capacity), serialized capacity gate с сохранением inbox при saturation и concurrent PostgreSQL
lease/settlement уже реализованы. Для двух оставшихся внешних доказательств
добавлены отдельные fail-closed инструменты:

- `pnpm push:soak` — fixture-only production-duration soak. Synthetic sender
  видит только собственный namespace, принудительно проходит 503→retry→201,
  проверяет exactly-once acceptance, drain, queue pressure и cleanup; artifact
  `artifacts/web-push-soak-evidence.json` имеет checksum и отдельный validator
  `pnpm push:soak:verify`;
- `pnpm push:provider:probe` — одноразовая отправка через настоящий production
  sender/VAPID/anti-SSRF к реальной browser subscription. Artifact
  `artifacts/web-push-provider-evidence.json` сохраняет только provider origin,
  SHA-256 endpoint/public-key fingerprints, HTTP status и timing; endpoint,
  p256dh/auth и private VAPID key в evidence не сериализуются. Validator:
  `pnpm push:provider:verify`.

Core `release:verify` теперь только ссылается на эти artifacts по
`present/valid/sha256` в отдельном `externalEvidence`; core
`releaseCandidate` намеренно не выдаёт их отсутствие за пройденную public
production acceptance.

- **Статус:** tooling готов, но evidence ещё не получена на staging/целевой сети.
- **Следующий шаг:** на изолированной staging-БД выполнить минимум 15-минутный
  soak с `NEXUS_WEB_PUSH_SOAK_ACK=YES`, затем live provider probe с реальной
  browser subscription и полным VAPID набором. Оба validators должны пройти;
  artifacts привязать к тому же release SHA. Не использовать production
  пользовательскую subscription/queue для synthetic soak.

## P2 — известные ограничения

### P2-1. Внешние ресурсы недоступны из сети владельца

`master.multitheftauto.com` (master-list) не отвечает даже с хоста —
похоже на региональную блокировку сети. Историческая зависимость fresh demo
seed от `images.unsplash.com`/DiceBear устранена: новый baseline не записывает
remote media URL и использует UI-fallbacks. Старые dev-тома могут адресно
очистить только точные legacy seed URL через `pnpm db:seed:repair-media`;
пользовательские replacements сохраняются. Live-серверы при недоступности
official master без настроенного mirror по-прежнему не отображаются.

- **Изменение:** master-list runtime теперь поддерживает до трёх явно заданных
  оператором HTTPS fallback endpoints через `MTA_MASTER_MIRROR_URLS`.
  Официальный `master.multitheftauto.com` всегда идёт первым; все попытки
  делят единый 10-секундный budget. Mirror обязан пройти тот же 8 MiB bound,
  ASE parser, server-count limit и EOF validation. Конфигурация отклоняет HTTP,
  credentials, IP literals, localhost/mDNS, single-label hostnames, нестандартный
  порт, дубли и больше трёх endpoints. Ошибка всех источников остаётся generic
  и не раскрывает operator endpoint клиенту.
- **Следующий шаг:** поднять/выбрать реально контролируемый mirror в целевой
  production-сети, настроить его через environment и подтвердить live refresh
  + stale fallback при недоступном official endpoint. Это изменение даёт
  безопасный механизм переключения, но само по себе не доказывает доступность
  какого-либо mirror. Для реальных пользовательских превью по-прежнему
  предпочтителен upload в контролируемое storage; fresh demo-data от внешнего
  image CDN больше не зависит.
- **Изменение:** превью ресурсов теперь скрывает недопустимые HTTP/HTTPS-адреса
  и показывает RU/EN-заглушку при ошибке декодирования или загрузки, включая
  кешированную ошибку до гидрации. Open Graph применяет ту же проверку URL.
  Browser-сценарий сломанного изображения прошёл на RU/EN в CI.

### P2-2. Dev-стек и нестандартные внешние hostname

Первоначальная проблема с Compose-hostname закрыта в CI: dev-конфигурация
разрешает стабильный service DNS `app` (и сохраняет совместимость с
`nexus-local-app-1`), а Chromium проверяет настоящий hydrated UI через
`localhost:3000` и `app:3000`. В обоих случаях theme toggle изменяет
DOM/localStorage, а login form отправляет client-side `POST /api/auth/login`
и не деградирует в нативный GET.

- **Остаётся ограничение:** произвольный LAN/IP/custom hostname намеренно не
  разрешён автоматически. Его нужно добавлять явным trusted dev origin, иначе
  Next.js dev-origin protections должны продолжать fail closed.
- **Следующий шаг:** отдельная работа нужна только если появится реальная
  потребность поддерживать конкретный LAN/custom dev hostname.

### P2-3. Скачивание: целевые устройства, браузеры и production-нагрузка

Реализованы настоящие ZIP для inventory и drift, транзакционный повторяемый
seed, проверка занятых ID/slug, сохранение пользовательских правок и явный
`db:seed:repair` для size/hash известных демосборок. Чужие файлы не заменяются;
модерационные статусы не сбрасываются. Изменённая версия/статус продукта
блокирует повторное добавление отсутствующей демосборки.

- **Проверено:** файловые и HTTP-тесты, логика транзакций с моками, типизация
  и сборка. Публичное и модераторское скачивание отклоняют известное
  несовпадение размера/хеша до аудита; исчезнувший файл возвращает 404.
- **Проверено 2026-09-30:** локальный provider хеширует открытый файл перед
  выдачей. Настоящее повреждение того же размера отклоняется обоими HTTP-
  маршрутами до аудита. Запись файлов атомарна; повторный ключ и проигравшая
  конкурентная запись не перезаписывают опубликованные байты.
- **Ограничение:** внешняя запись в тот же inode после проверки остаётся
  возможной; это не неизменяемый снимок файловой системы. Хеширование добавляет
  полное чтение с диска перед ответом — нужен нагрузочный замер. Чужие
  placeholder-файлы и временные файлы после аварийного завершения процесса
  требуют ручного разбора.
- **Проверено дополнительно:** длинные/Unicode имена архивов не входят в ключ
  хранения; идентификатор владельца проверяется до записи файлов.
- **Проверено дополнительно:** отмена запроса прекращает подготовку архива
  между блоками чтения и закрывает поток. Тесты покрывают отмену до открытия,
  во время хеширования, до/во время аудита и очистку обработчика отмены.
  Реальный обрыв HTTPS-соединения во время передачи и повтор проверены в CI;
  обрыв до ответа во время хеширования остаётся отдельной живой проверкой.
- **UI скачивания:** ошибки теперь остаются на странице ресурса с RU/EN
  сообщениями, прогрессом и отменой. Тесты клиента и серверного рендера прошли;
  Playwright-сценарии ошибки 409, тайм-аута, отмены и повторного скачивания
  прошли на `e05c75b`; проверяется SHA-256 реально сохранённого файла.
  Тайм-аут и отмена используют синтетический fetch. Реальный обрыв соединения
  до ответа при хешировании остаётся отдельной проверкой. На `e1bc341` Chromium скачал реальный файл
  64 МиБ на RU/EN с проверкой размера и SHA-256; неполный ответ и ошибка потока
  отклонены. Пиковая память и реальный сетевой обрыв ещё не измерены.
- **Проверено на `a7d6080`:** три настоящих HTTPS/TCP-обрыва после 1 МиБ,
  повтор с точным размером/SHA-256 и четыре параллельных медленных скачивания
  по 64 МиБ. RSS HTTP-процесса: 262 308 → 308 336 КиБ, прирост 46 028 КиБ
  (~45 МиБ), ниже бюджета 128 МиБ. Web Stream считает очередь по байтам
  (64 КиБ), включая модераторское скачивание. Это замер одноразового CI,
  а не памяти браузера/контейнерного кеша или production-пропускной способности.
- **Проверено на `33d400f`:** все четыре CI-процесса зелёные, 1063 теста.
  При загрузке 64 МиБ наблюдаемый прирост суммарного RSS процессов Chromium
  составил 117 652 КиБ (~115 МиБ), ниже бюджета 384 МиБ. Выборки с интервалом
  не менее 50 мс включают передачу, сохранение файла и освобождение handoff URL.
  Сумма RSS повторно учитывает общие страницы; это регрессионный замер, не точный
  пик физической памяти и не доказательство возврата к исходному уровню.
  Клиент хранит блоки в Blob вместо отдельного массива ArrayBuffer.
  TCP-обрыв во втором production-процессе Next.js после первого реального чтения
  64 КиБ остановил хеширование до второго чтения, закрыл файл без download-аудита.
  Повтор скачал 64 МиБ с точным SHA-256; процесс проверки штатно остановлен.
  Пауза чтения внедрена внешним preload только в CI; соединение loopback TCP,
  без Caddy/TLS. Обычная HTTPS-передача и её обрывы проверяются отдельно.
- **Следующий шаг:** проверить память и нагрузку на целевых данных/устройствах,
  другие браузеры и отмену до ответа через production-прокси. На PostgreSQL 18
  выполнить миграции, seed дважды,
  адресный repair и оба claim/download-сценария; проверить сохранность
  пользовательских правок и поведение реальных конкурентных транзакций.
  Seed-baseline integration и browser claim/download прошли в CI. Полное
  сочетание адресного repair с обоими деморесурсами отдельно не подтверждено.

### P2-4. Инвентаризация типов перед миграцией существующей production-БД

Миграция `0024_product_type_invariant` и оба product-types integration-теста
успешно выполнены на изолированном PostgreSQL 18 в CI `01f79da`. Это подтверждает
CHECK, известный алиас tool → plugin и отказ на неизвестных значениях.
Перед применением к существующей production-БД остаётся проверить распределение
типов и резервную копию именно этой БД; CI использует одноразовый набор данных.

### P2-5. Тестовая инфраструктура: хрупкости и производительность

- root `tests/` всё ещё содержит cross-workspace integration и часть
  legacy HTTP suites; Support status-vs-status и reply-vs-status mutations
  теперь используют PostgreSQL compare-and-swap contracts, поэтому stale
  moderation/reply не может silently вернуть thread в `open`. HTTP 409
  различает final closed case и concurrent message conflict, а client
  перечитывает authoritative thread перед показом ошибки; но ownership постепенно выровнен: comment repository
  contract живёт в `packages/db/src/repositories/`; comment form/client —
  в `apps/web/src/components/`; reports, verification, follow, article-comment
  и support HTTP suites перенесены непосредственно к своим Route Handlers.
  Focused `test:reports` и `test:verification` обновлены на новые пути.
  Verification proof URL parser снова синтаксически валиден (`http/https` only) и покрыт прямым HTTP regression; hosted runner не успел поймать этот build-blocker из-за zero-step allocation. Follow GET cache contract объединён с colocated follow suite, inbox /
  preferences / Web Push correlation suite перенесён к `/api/notifications`,
  а current-session, password-change и session-revocation HTTP contracts —
  непосредственно к auth Route Handlers. Root devDependencies остаются только
  для оставшихся cross-workspace suites; перенос продолжать по мере правок;
- private GET cache source policy заменён прямыми HTTP response assertions:
  auth context, notification preferences/inbox, reports, verification, follow
  и downloads подтверждают `private, no-store` + `Vary: Cookie`, а
  products/servers/content/search/MTA directory — явный public cache contract;
- surface-тесты сверяют точные строки исходников — ломаются при
  переформатировании; при правках предпочитать regex/поведенческие проверки.
  Discover query parsing/href contract уже переведён на прямую поведенческую
  проверку; active/expired session listing проверяется через реальный PostgreSQL
  repository contract, GET/DELETE session-management и password-change route —
  через HTTP behavior tests без чтения route source. Устаревший
  `account-security-surface.test.ts` удалён; PWA/Web Push surface tests теперь
  исполняют реальный service-worker source в изолированном VM и проверяют
  cache/offline/push/click поведение вместо совпадения строк. Report workflow
  больше не имеет дублирующего source-only теста: HTTP boundary + repository
  transaction/advisory-lock tests покрывают его поведением. Server-follow
  fanout переведён с чтения исходника на unit behavior (limit, author exclusion,
  concurrency, preference suppression и push failure), а comment notification
  path — на HTTP behavior; source-check оставлен только для внутреннего comment
  transaction/counter invariant без дешёвого unit seam. Free-resource acquisition
  больше не читает UI/repository source: claim/download/idempotency покрыты HTTP,
  PostgreSQL и browser journeys, а legacy checkout redirect — прямым behavior test.
  Build retirement source-policy заменён HTTP contract + PostgreSQL lifecycle
  integration (last published → draft, fallback published version). Closed-beta
  paid/product source policies теперь проверяются поведением: checkout 503 code,
  paid create/release rejection до write, free-only listing/public visibility и
  entitlement claim/check. Build moderation UI source-policy заменён pure UI-state contract + SSR
  reviewer-artifact behavior; reviewer bytes/moderation остаются под PostgreSQL/HTTP
  integration. Download route теперь прямо доказывает использование deterministic
  latest-published selector, поэтому отдельный source-only publication test удалён.
  Build moderation/quarantine policies используют service behavior guards поверх
  PostgreSQL/HTTP integrations:
  pending/CAS/scan provenance/release event и published/quarantined trusted-restore
  state machine. Discover/workspace source checks теперь заменены rendered navigation,
  compatibility redirect и SavedPage privacy/repository behavior; legacy commerce
  workspace routes вызываются напрямую. Public-resource availability source inspection также заменён: service detail fail-closed проверяется unit behavior, а catalog safe-build scope — реальным PostgreSQL переходом `no build → unsafe build → provenance-backed clean build`. Оставшиеся source-surface тесты сокращать
  по мере изменения функций. Content API/publication/moderation/feed source policies
  теперь заменены HTTP/service/schema behaviors: cache/auth/rate-limit, server-derived
  status authority, organization access, moderation CAS/audit и published detail/feed
  separation. Product review authority/integrity source checks также удалены:
  HTTP behavior покрывает auth/manager/entitlement/conflict boundaries, а
  PostgreSQL integration теперь проверяет concurrent aggregate serialization,
  DB uniqueness и fail-closed unpublished state. Server updates/reverse
  dependencies source suites тоже удалены: реальные PostgreSQL filters,
  server-detail parallel behavior, reverse summary bounds и rendered RU/EN
  unavailable/empty/list states покрывают контракт без чтения исходников.
  Public server-directory composition, resource trust/provenance chain и
  resource-detail acquisition UI также переведены с чтения JSX/source на
  HTTP/SSR behavior: localized directory shell, full recorded SHA/scanner/signature
  facts, free/paid/entitled/manager acquisition states и ровно один latest-build
  download action при длинной build history. Account recovery source checks
  заменены чистыми proof/history/request/timing contracts; admin content
  moderation — SSR behavior controls + HTTP/service tests; RU/EN root shell
  wiring — реальным RootLayout render вместо чтения JSX-файлов. Server
  experience source checks также удалены: live authority/management проверяют
  SSR behavior suites, create/update/follow/claim — confirmation parsers, а
  server client requests используют единый tested private API policy
  (`same-origin`, `no-store`, bounded timeout/caller abort). Generic
  client-mutation source inspection удалён: server/admin confirmations уже
  имеют dedicated behavior tests, notification preferences теперь имеют
  colocated canonical parser/confirmation suite, а private cache headers
  проверяются прямыми HTTP assertions;
- классификатор использует SWC AST вместо собственного tokenizer. Неизвестные
  динамические/неразрешённые импорты остаются консервативными, ошибка синтаксиса
  останавливает запуск с путём файла; это не полный evaluator произвольного кода;
- unit-проект уже выполняется параллельно четырьмя workers; только database
  проект последовательный из-за общих очередей и точных счётчиков. Следующий
  шаг — заменять оставшиеся проверки строк исходников поведением по мере
  изменения соответствующих функций;
- policy-тест документов (`tests/mainline-repository-policy.test.ts`) —
  источник правды по составу документации.

### P2-6. Хост-тулинг не соответствует engines

Хост: Node 22.23.2 / pnpm 12.4.1; проект требует Node ≥ 26 / pnpm 12.4.2.
Хост-скрипты `pnpm dev:docker:*`, `pnpm test:isolated` работают через Docker,
но host-side `pnpm check` без контейнера невозможен. pnpm-автоустановка
зависимостей при host-run создаёт лишний `node_modules` на хосте — установка
предотвращена (`verifyDepsBeforeRun: warn`).

Репозиторий явно пинит проверенный Node 26.10.0 одновременно через
`.nvmrc` и `.node-version`; `package.json#packageManager` остаётся
источником pnpm 12.4.2. `nexus:doctor` теперь сам сверяет оба Node-файла,
показывает pin в facts и при старом Node даёт конкретную подсказку `nvm use`;
contract-test не даёт version files разойтись.

- **Следующий шаг:** обновить сам хост до repository-pinned Node 26.10.0 и
  pnpm 12.4.2 либо держать разработку строго в Docker-пути.

## P3 — гигиена и улучшения

- **Dev-БД загрязнена тестовыми данными** (~1600 пользователей, `*_mum*`
  артефакты integration-тестов) — ожидаемо для dev; для чистых прогонов
  использовать `pnpm test:isolated`; при необходимости пересоздать том
  `nexus-local_pgdata` и накатить `pnpm db:seed`.
- **Проверять «живость» сайта браузером регулярно** — скрипты живого тура
  сохранены вне репозитория (`~/nexus-ux-audit/`), запускаются контейнерным
  Chromium против `localhost:3000` (установить: `apk add chromium` в dev-контейнер,
  `npm i playwright-core` в `/tmp` контейнера).

---

## Недавно исправлено (справочно, из истории)

- 2026-10-09 — bounded MTA master response reader заменил массив
  сетевых чанков на ограниченный геометрически растущий байтовый буфер:
  8 МиБ остаются абсолютным лимитом. Тесты покрывают 20 000 чанков по
  байту, рост за 64 КиБ и некорректные лимиты. SQL unit tests истории
  исправлены с учётом фактического формата Drizzle timestamp SQL params
  (ISO-строка, а не объект Date). Полный CI ждёт hosted-runner.


- 2026-10-09 — HTTP-кеширование каталога MTA Master ограничено
  оставшимся сроком свежести 60-секундного снимка, но не больше 30 секунд.
  Отключён дополнительный `stale-while-revalidate` для live статусов:
  старые, повреждённые и будущие метки времени, а также недоступный upstream,
  возвращают `Cache-Control: no-store`. Оба публичных API используют общий
  helper с граничными контрактными тестами; полноценный CI пока заблокирован.


- `5cd4f04`–`70e5c0e` — адресные пояснения Biome: группа ссылок и кнопки
  не является полем формы, ASCII-диапазон SMTP намеренный, тема использует
  статический локальный скрипт без пользовательских данных.

- `4be43ee`–`d7bf5a9` — адресные подавления `noThenProperty` для трёх
  намеренно awaitable моков Drizzle; переименование `.then` нарушило бы тест.

- `48d6f01` — каталог использует нативную область `<search>` вокруг формы.
- `3bd859d` — диалог закрывается кнопкой фона и Escape; фокус
  возвращается после закрытия.

- `17b95e5` — звёзды рейтинга используют фиксированные числовые ID.
- `7da7973` — повторяющиеся URL доказательств не создают дубли ссылок,
  уникальный URL служит ключом; ссылка получает читаемую подпись.

- `6cd0129`–`394d65c` — ID наблюдения проходит в историю сервера и
  используется как ключ столбца графика.
- `1f0cb38` — фиксированные ключи заглушек уведомлений.

- `0aa5bc8` — командная панель закрывается кнопкой фона; фокус поиска
  устанавливается при открытии и возвращается после закрытия.

- `2cfb4b4` — фиксированные идентификаторы ключей для четырёх loading-карточек.

- `43a996f` — объявление в `switch` маршрута follow заключено в блок.
- `60ccbd0` — счётчик оценок статьи доступен через видимый текст без
  неподдерживаемого `aria-label` на обычном `div`.

- `b33371a` — claim UI принимал 201 за ошибку; download 500→404 при
  отсутствии файла; home SSR ждал 10.1s у каждого посетителя при недоступном
  master-list (добавлен failure backoff, замер: 10.08s → 0.09s).
- `ea5235c` — восстановлена детерминированная верификация: root-тесты
  резолвят `next`/`drizzle-orm`; сериализация тест-файлов и сброс disposable
  очереди убрали межфайловые гонки; `.github` возвращён в docker-контекст;
  добавлен `pnpm test:isolated`.
- 2026-09-29 — ветки GitHub почищены (остался только `main`; бэкап-бандл
  всех веток: `~/backups/mta-nexus-site-all-branches-20260929-044934.bundle`);
  Docker очищен от ресурсов других проектов (~2.8 GB).
- `a93ed14` — датированные аудиты убраны из `docs/` (policy-тест), реестр
  проблем консолидирован в этот файл.

- 2026-10-09 — восстановление повторной отправки Support привязано к SHA-256
  дискриминатору авторизованного пользователя. Другой аккаунт в той же вкладке
  не наследует UUID предыдущего; при недоступной проверке сессии восстановление
  отключается, отправка остаётся на серверном контроле. Старые v1 слоты не читаются;
  содержимое обращения по-прежнему не хранится в sessionStorage.

Уведомления: подготовлена миграция 0035 с индексами по получателю для общего
и непрочитанного inbox. Добавлены устойчивый порядок при одинаковой дате,
нормализация лимитов и PostgreSQL-тест на 20 125 строках с планами до/после.
Upgrade rehearsal теперь проверяет оба индекса. Локальные SQL-builder проверки
не подтверждают ускорение на PostgreSQL; acceptance и планы ожидают успешного CI.

### P2. Validate effective library access on PostgreSQL after migration 0036

An indexed, bounded SQL-based library replaces full in-memory entitlement
enumeration in the player workspace and provides a noindex, RU/EN
`/workspace/library` page. The view suppresses metadata for unavailable
products and never serves downloads without server-side reauthorization.
Remaining deployment acceptance:

- Run PostgreSQL integration tests for duplicated direct grants, expired
  grants, active/expired/revoked legacy licenses, unpublished or unsafe builds,
  filters, stable page order and cross-account isolation.
- Apply migration `0036` to a disposable clone and review the query plans
  and partial index usage under realistic grant volume; rehearse rollback and
  retry with the current journal head.
- Exercise a real browser download after ownership or published-build changes
  between rendering the library and requesting a file.
- Do not mistake library `ready` or legacy paid records for a license issuer
  or payment provider. Closed-beta checkout remains explicitly disabled.

These are acceptance tasks, not claims that CI/PostgreSQL already passed.

### P2. Historical build delivery race and remote artifact digest

Pinned resource downloads now query a specific current safe, published build
under the exact product ID and send a version identity response header which
the browser verifies before handing off bytes. This closes accidental
wrong-version selection and unauthorized cross-product selection, but does
**not** fully serialize moderation with storage delivery.

- Concurrent retirement/quarantine after the SQL read but before the object
  stream opens can still race. Consider transactional delivery reservations
  or an immutable, revocable artifact gate without holding DB transactions
  across a slow stream. Include a live PostgreSQL quarantine-vs-download
  test, and confirm no stale bytes are delivered after a completed revoke.
- A trusted scan and recorded SHA-256 are provenance facts, not independently
  proven file bytes on every storage backend. Download routes now require
  actual storage-provider size **and** SHA-256 metadata (or fail with 409),
  and local storage hashes the opened descriptor before delivery. A future
  remote implementation must still prove the bytes with its own trusted digest
  or bounded streaming SHA-256, not merely echo metadata from the database.
- Browser/HTTP, scoped SQL pagination and empty/noindex archive behavior have
  tests but still need an exact-SHA runnable CI acceptance pass.

Do not enable unsafe historical statuses to improve availability.

### P2. Local storage confinement: target-runtime verification and descriptor regressions

The local storage provider now opens each directory component with
`O_DIRECTORY | O_NOFOLLOW` through a pinned descriptor and opens asset files
with `O_NOFOLLOW`. It also rejects cross-boundary hard-linked files.
The security contract assumes a deployment-controlled storage root and
its ancestors and requires POSIX descriptor paths (Linux `/proc/self/fd`).
The safety suite includes rename/symlink substitution and descriptor cleanup
checks. Earlier tests were updated to distinguish the new directory handles
from the actual archive descriptor, and `.` is explicitly an invalid key.

- **Remaining acceptance:** run the complete storage suite and build on the
  project's Node.js 26/Linux container, then inspect error-path descriptor
  counts under concurrent traffic. Node 22 smoke coverage is not equivalent.
- **Boundary:** external writers with the same Unix UID can still mutate an
  already-open inode in place between the hash pass and streaming. In a secure
  deployment the storage volume must be writable only by the storage service.
  Browser SHA-256 verification rejects corrupted delivery but is not an
  authorization or revocation barrier.
- **Operations:** on a host without a trusted root or a functioning descriptor
  filesystem the provider must fail closed, never silently fall back to path
  traversal or non-atomic overwrites.


#### Cancellation at stream creation

A pre-existing race allowed `AbortSignal` to fire inside the creation of a
local file stream before its abort handler was registered. The provider could
then return a live, readable stream for an already cancelled request. The local
provider now registers the listener, rechecks `signal.aborted`, destroys the
stream and rejects the operation. The regression test cancels synchronously
inside `FileHandle.createReadStream`. Isolated Linux Node.js 22 tests passed;
full Node.js 26 repository and CI acceptance remain pending.

### P2. In-memory domain events are best-effort after a committed write

Product/build mutations and audit rows commit independently of in-memory
subscribers. EventBus now converts synchronous and asynchronous subscriber
failures into settled results, and logs only event identifiers and failure
counts. ProductService does not turn post-commit dispatch exceptions into
an HTTP failure that would trigger deletion of a referenced archive.

- **Remaining limitation:** the event bus is not a persistent outbox. An event
  may be lost if the process terminates after database commit. Critical
  external effects require a transactional outbox with durable retries.
- **Acceptance:** run post-commit resilience tests on Node.js 26 and verify
  database records and retained files with PostgreSQL in CI.

### P2. MTA master-list stream cancellation needs target-runtime acceptance

The MTA directory reader now rejects invalid/oversized declared lengths before
buffering, initiates cancellation without waiting on a potentially stalled
upstream stream, and listens to the endpoint timeout during body reads. A
malfunctioning mirror must not block fallback to another configured mirror.

- **Remaining acceptance:** run bounded-reader tests on the required Node.js 26
  runtime and verify fallback during real upstream stalls. The current hosted
  GitHub runner blocker still prevents an exact-SHA CI/browser acceptance pass.

### P2. Organization server registration scope needs live acceptance

Server registration now offers an authenticated, bounded list of organizations
owned or managed by the current user (owner/admin roles or explicit
manage_servers permission). The chooser returns only ID, name and slug.
This is not an authority grant: POST /api/servers rechecks rights. A failed
lookup leaves personal registration usable and organization choice disabled.

- Remaining acceptance: run the PostgreSQL role/permission/revocation tests,
  browser registration for an owner and delegated manager, and a scenario
  where organization rights are revoked between option loading and creation.
  CI-001 still prevents exact-SHA hosted acceptance.

### P2. Atomic organization server creation and post-commit events

Server creation now checks organization ownership / manage_servers membership
inside the same PostgreSQL transaction as the server and audit insert. Share
locks prevent a concurrent owner transfer or membership permission revocation
from slipping between the authorization read and durable write. This is a
separate control from the UI organization selector, which is never authority.

The in-memory server.created event remains best-effort after commit; a handler
or dispatch failure must not return a false server-registration failure.
Delivery is not durable and still needs an outbox if guaranteed events become
a product requirement.

- Remaining acceptance: PostgreSQL role-revocation and concurrent-write
  tests on the target DB, plus event-dispatch regression tests on Node 26.
  CI-001 currently prevents hosted exact-SHA execution.

### P1. Owner edits: transactional authorization, stale forms and uniqueness

Owner-facing PATCH now uses `updateManagedWithAudit`, which locks the server
row and then locks the applicable organization/permission rows before
updating metadata or writing its audit event. A revoked organization manager
cannot reuse a previously rendered form to update a server. The older
`updateWithAudit` helper remains for explicitly trusted internal migration
and test paths; it is not used by HTTP mutations.

An optional `expectedUpdatedAt` UTC/offset ISO timestamp rejects stale
updates with `409 SERVER_METADATA_CONFLICT`. The UI sends this token and
renders localized reload guidance. Editor timestamps increase monotonically
at millisecond precision even for immediate successive saves.

Known PostgreSQL slug and endpoint uniqueness constraints now return
actionable 409 errors, without returning database exception details. The
owner-facing API returns application error codes only for typed `AppError`.

- Acceptance: run transaction role/revocation/stale-edit unit tests and
  PostgreSQL integration and race tests on Node 26, followed by RU/EN browser
  checks and exact-SHA GitHub Actions verification. CI-001 still blocks
  hosted execution; no successful test run should be inferred.

### P1. Owner canonicalization and complete save acknowledgments

The server service now derives the personal owner from the authenticated actor
and never accepts a caller-supplied owner as authoritative. Organization
registrations clear the personal owner. HTTP POST rejects unexpected fields
with a strict creation schema and bounds organization IDs.

The frontend confirmation checks the chosen organization and all submitted
editable metadata, including ordered lists. A version-guarded update must
return an incremented authoritative timestamp; otherwise the UI does not
display success. Existing callers that do not supply an organization or
revision continue to use their legacy checks.

Validation and confirmation regressions were added. Exact-SHA Node 26,
PostgreSQL, browser and full-workflow checks remain required because
CI-001 still blocks GitHub-hosted runners.

### P1. Bounded server mutation request bodies

Server creation and owner-edit routes use a shared 32 KiB JSON reader with
an actual streaming byte ceiling; forged Content-Length cannot bypass the
limit. Oversized requests return typed HTTP 413 before database mutation.
Stream cancellation is best-effort and nonblocking. Invalid JSON retains the
existing HTTP 400 schema behavior.

The personal-registration test fixture no longer passes undefined to a
defaulted organization parameter. A separate administrator-role test covers
platform-admin organization creation.

- Acceptance: run HTTP/streaming tests and typecheck on Node 26.
  CI-001 blocks exact-SHA hosted acceptance (zero steps).

### P1. Bounded mutation bodies: deadline and localized errors

The 32 KiB server registration/edit request reader now also has a ten-second
deadline against slow or indefinitely stalled client streams. The timeout
cancels the stream without waiting on an uncooperative underlying cancel
promise, returns typed HTTP 408 REQUEST_BODY_TIMEOUT, and removes its abort
listener when finished. The caller's abort reason takes precedence when the
client itself disconnects. A malformed Content-Length now cancels unread data.

Registration and management forms use one compact error-code translation
helper and new RU/EN messages for duplicate slugs, duplicate MTA endpoints,
lost organization/editing permissions, stale edits, oversized bodies and body
timeouts. Both HTTP routes share the same bounded reader.

- Local isolated Node 22 smoke check of the copied bounded-json implementation
  passed seven focused scenarios (including a stalled stream). This is not
  project Vitest/typecheck or Node 26/PostgreSQL acceptance. Dedicated Vitest
  regressions were added and remain to be run after CI-001 is resolved.

### P2. MTA server endpoint aliases and legacy normalization

The official directory has always treated case and a terminal DNS dot as
equivalent for endpoint matching, but editable server addresses previously
retained the raw form in the PostgreSQL unique (address, game_port) index.
Registration, owner updates, direct service entrypoints and their forms now
share a domain-level canonicalizer. Both create/update Zod contracts reject
empty, URL-shaped, credential-shaped, host:port and malformed address values
while preserving IPv4, DNS and IPv6 spellings. Unit regressions cover equivalent
hosts and invalid forms.

**Remaining DB acceptance:** audit existing rows for canonically equivalent
(address, game_port) tuples before adding any normalized database-level unique
index. Do not automatically rewrite legacy addresses or add the expression
constraint before resolving collisions and ownership claims. The raw unique
index remains as a backstop for newly canonicalized writes, but legacy aliases
and internal direct DB writers need a separate data migration. Exact-SHA Node
26/PostgreSQL/browser CI is still blocked by CI-001.

### P1. Endpoint audit before canonical database uniqueness

The shared MTA hostname canonicalizer now parses bracketed and unbracketed IPv6
using the platform URL parser, canonicalizes equivalent IP spellings and IDN
hostnames, and rejects malformed hostnames and embedded ports. Focused checks
passed in the isolated Node 22/TypeScript harness; Node 26/Vitest acceptance
remains outstanding.

Run `pnpm --filter @nexus/db server:endpoint:audit` against a read-only
PostgreSQL account to get only summary counts. The command performs no UPDATE
or DELETE and returns exit code 2 if invalid, noncanonical, or colliding
endpoints were detected. Detailed addresses and IDs require BOTH
`NEXUS_SERVER_ENDPOINT_AUDIT_ACK=YES` and `--details`; handle output as
sensitive operational data. This is an operator audit, not an automatic fix.

Outstanding: resolve legacy duplicates and ownership claims case by case,
then design an indexed database-level uniqueness guard. Audit results are not
transactionally frozen; rerun immediately before any future migration. Full
DB acceptance is blocked by CI-001 until hosted runners execute.

### P1. Endpoint audit now highlights claims and verified server collisions

The read-only endpoint scanner also fetches ownership scope (personal owner,
organization owner, unclaimed) and verification flag. The default output keeps
all IDs and network endpoints private and reports only total invalid, mixed
ownership, unclaimed, duplicate, cross-ownership and verified-collision counts.
Detailed owner scopes, server IDs and verified IDs are returned only with
`--details` and the explicit acknowledgement environment variable.

Any collision involving distinct owners, an unclaimed server and a claimed
server, or a row with both personal and organization ownership is classified
as requiring manual attention. Verified listings are highlighted separately
so owners' verification evidence and server claim challenges are not silently
transferred. This audit does not authorize automatic normalization or changes
to license/server ownership.

Remaining: operate on the actual database with a read-only PostgreSQL user,
compare the report with server claims, then implement a reviewed and reversible
migration. No DB records have been changed by this development block.
