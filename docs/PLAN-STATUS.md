# MTA NEXUS — Статус выполнения планов (аудит реальности)

**Дата аудита:** по состоянию коммита `e183d54` + последующие исправления изоляции данных.
**Метод:** сверка каждого требования планов PLAN-001…PLAN-004 с фактическим кодом и runtime-проверками (HTTP-запросы, тесты, анализ импортов).

> Важный принцип документа: здесь фиксируется **что реально работает**, а не то, что планировалось.
> Расхождения, найденные в ходе аудита, были исправлены или честно помечены как Known Limitations.

---

## Сводная таблица

| План | Версия | Статус выполнения | Найденные расхождения | Действие по итогам аудита |
|---|---|---|---|---|
| PLAN-001 | Nexus 1.0 | Выполнен (базис) | Нет критических | — |
| PLAN-002 | Nexus 1.1 | Выполнен | Нет критических | — |
| PLAN-003 | Nexus 1.2 | Выполнен с нарушениями изоляции | 3 критических (см. ниже) | **Исправлено** |
| PLAN-004 | Nexus 1.3 | Выполнен с оговорками | 2 оговорки (см. ниже) | Задокументировано |
| PLAN-005 | Nexus 1.4 | Выполнен (вне рамок этого аудита) | — | — |

---

## PLAN-001 — Nexus 1.0 (Prototype → Foundation)

### Подтверждено фактически
- **Modular monolith:** `apps/web` + 7 пакетов (`@nexus/domain`, `@nexus/db`, `@nexus/security`, `@nexus/storage`, `@nexus/validation`, `@nexus/config`, `@nexus/ui`) — все присутствуют, workspace-протокол `workspace:*` работает.
- **Docker:** `compose.yaml` поднимает PostgreSQL (контейнер `nexus-postgres`). Проверено: контейнер запущен, миграции применяются.
- **ENV-валидация:** Zod-схема в `packages/config` валидирует переменные при старте.
- **Тесты:** Vitest-набор в `tests/`, `pnpm check` = typecheck + test + build.
- **Event system:** `packages/domain/src/events.ts` — типизированный `InMemoryEventBus`, события публикуются сервисами (product.created, build.released, license.issued, payment.completed).
- **Security package:** `can()` policy engine, scrypt-хеширование паролей, префиксные opaque ID (`usr_`, `prd_`, `lic_`…), rate limiter.

### Замечания аудита
- Исходная реализация PLAN-001 работала на in-memory `NexusDataStore` — это было легитимно для 1.0, устранено в PLAN-002 (файлы `store.ts` и `mock-data.ts` удалены из репозитория).

---

## PLAN-002 — Nexus 1.1 (Real Core)

### Подтверждено фактически
- **PostgreSQL runtime:** все сервисы (`auth-service`, `product-service`, `server-service`, `commerce-service`, `content-service`, `admin-service`) импортируют репозитории из `@nexus/db`, а не mock-хранилище. Поиск по `grep "store\." apps/web/src` — 0 совпадений.
- **Репозитории:** 16 файлов в `packages/db/src/repositories/` (users, sessions, organizations, servers, products, builds, licenses, entitlements, orders, payments, ledger, content, audit, reports, notifications, social, telemetry, verification).
- **Миграции:** `pnpm db:generate` / `pnpm db:migrate` работают против реального PostgreSQL (26 таблиц, миграция `0000_large_paladin.sql` + `0001_purple_sauron.sql`).
- **Seed:** `pnpm db:seed` (`packages/db/src/seed.ts`) — отдельный development-скрипт, не загружается runtime.
- **Auth:** регистрация/логин через scrypt-хеши, сессии в БД с `token`, `expiresAt`; httpOnly cookie. Подтверждено тестами `tests/auth-real.test.ts` (7 тестов: дубликаты email/username, неверный пароль, logout, инвалидация сессии).
- **Entitlement engine:** `hasEntitlement(subject, resource, permission)` проверяет прямые записи и активные лицензии. Подтверждено `tests/entitlement-engine.test.ts`.
- **Ledger:** append-only, двойная запись подтверждена тестом баланса дебета/кредита в `tests/commerce-state-machine.test.ts`.
- **Health checks:** `/api/health`, `/api/health/db` (SELECT 1 + latency), `/api/health/storage`.

### Замечания аудита
- none: критических расхождений не найдено.

---

## PLAN-003 — Nexus 1.2 (Public Platform)

### Подтверждено фактически
- **Shell/Sidebar/Notifications:** `NexusShell`, сворачиваемый сайдбар, колокольчик с unread-счётчиком и выпадающим списком.
- **Профили:** `/users/[username]`, `/organizations/[slug]` рендерят реальные данные из БД (проверено HTTP 200 + наличие контента).
- **Purchases/Licenses:** страницы существуют, API-роуты авторизуют через сессию.
- **Notifications API:** `/api/notifications`, `/api/notifications/mark-read`.
- **Follow API:** `/api/follow` (GET/POST/DELETE).
- **Reviews:** `/api/products/[id]/reviews` с verified purchase и пересчётом рейтинга.
- **Reports + Admin actions:** `/api/reports`, `/api/admin/actions`.
- **Тесты:** `tests/public-platform-journeys.test.ts` (4 пользовательских сценария).

### ❗ Найденные критические расхождения (исправлены в ходе аудита)

| # | Заявлено в PLAN | Реальность до исправления | Исправление |
|---|---|---|---|
| 1 | TASK-012: «Доступ только к своим покупкам» | `/workspace/purchases` вызывал `orderRepository.listAll()` — **любой посетитель видел заказы всех пользователей** | Сессионная проверка + `listByUser(user.id)`, для анонимов — экран «Sign in required» |
| 2 | TASK-013: лицензии приватны | `/workspace/licenses` вызывал `licenseRepository.listAll()` — **утечка всех лицензионных ключей** | Сессионная проверка + `listByUser(user.id)` |
| 3 | TASK-022: «Saved — единая модель сохранённого» | `/workspace/saved` показывал featured-товары из маркетплейса — **функциональность была фиктивной** | Страница теперь показывает реальные follows пользователя (products/servers) через `socialRepository.listFollows` |

Дополнительно: `/workspace` (overview) и `/workspace/sales` были переведены на сессионную идентификацию (sales ранее брал `authorId` первого попавшегося продукта).

### Runtime-верификация после исправления
- Анонимный запрос `/workspace/licenses` → HTML содержит «Sign in required» ✅
- Аутентифицированный admin `/admin` → метрики и Verification Queue рендерятся ✅

---

## PLAN-004 — Nexus 1.3 (Hardening, Trust, Server Ecosystem)

### Подтверждено фактически
- **Secure download:** `/api/products/[id]/download` требует сессию + entitlement, отдаёт метаданные только реально существующего published build; fallback-хеши удалены (404 при отсутствии билдов). Rate limit 30/мин на пользователя.
- **IDOR в notifications:** `markAsRead(id, recipientId)` — проверка владельца на уровне SQL. Подтверждено тестом (user B не может отметить уведомление user A — получает `false`).
- **Social validation:** Follow принимает только enum-типы, проверяет существование цели, запрещает self-follow и дубли.
- **Review integrity:** verified purchase обязателен для платных продуктов, дубликаты и self-review отклоняются. Подтверждено тестами.
- **Rate limiting:** login 8/5м, register 5/ч, checkout 10/мин, downloads 30/мин, reviews 5/5м, reports 10/ч, verification 3/сут, admin 60/мин.
- **Наблюдения серверов:** NEXUS сам получает публичные данные MTA, сохраняет источник и время наблюдения; игровой сервер не устанавливает агент и не передаёт API-ключ.
- **Verification workflow:** `verification_requests`, approve/reject только через админ-действие, `isVerified` применяется только по решению модератора. Подтверждено тестом.
- **Seller dashboard:** `/workspace/sales` из реальных completed-ордеров и ledger-записей.

### ⚠️ Оговорки (не исправлены — задокументированы как Known Limitations)

| # | Требование плана | Фактическое состояние | Почему не блокер |
|---|---|---|---|
| 1 | TASK-039: rate limiting | `MemoryRateLimiter` — **in-memory, per-process**: сбрасывается при перезапуске и не разделяется между инстансами | Для single-instance deployment соответствуют плану; вынос в Redis осознанно отложен (план запрещал добавлять Redis без необходимости) |
| 2 | TASK-016: «не использовать hardcoded currentPlayers в production records» | Development seed содержит демо-значения игроков (342, 789) | Seed используется только для разработки; production-данные приходят из публичных MTA-наблюдений |

---

## Кросс-плановые проверки

### Что работает end-to-end (проверено HTTP + тестами)
1. Register → Login → Session cookie → Workspace (изолированный) ✅
2. Purchase → Payment state machine → Ledger balance → License + Entitlement ✅
3. License → Authorized download (реальный build, SHA-256) ✅
4. Review → verified purchase → rating recalculation ✅
5. Follow → Notification получателю ✅
6. Report → Admin resolve → Audit event ✅
7. Verification request → Admin approve → isVerified применён ✅
8. Heartbeat → live server statistics update ✅

### Известные ограничения платформы (честный список)
- Rate limiter in-memory (см. выше).
- Payment provider — только `sandbox` (внутренний mock, помечен как таковой в UI). Внешние платёжные провайдеры не подключены.
- Download delivery возвращает метаданные + delivery token; реальная отдача бинарного архива через signed URL требует подключения S3-провайдера.
- Email-уведомления не реализованы (планировались только в поздних планах; Mailpit в compose для будущего использования).
- `currentPlayers` без свежего публичного наблюдения имеет состояние `unknown`, а не фиктивный ноль.
- 2FA, email verification, password reset — foundation есть в схеме, flows не реализованы.

---

## Команда проверки (воспроизведение)

```bash
pnpm check          # typecheck + 31 тест + build
pnpm db:migrate     # применение миграций (26 таблиц)
pnpm db:seed        # development-данные
pnpm dev            # http://localhost:3000
```

Runtime-проверки изоляции:
```bash
# Анонимно — должен показывать "Sign in required":
curl http://localhost:3000/workspace/licenses
# Сессия админа — должна показывать метрики:
# (login через POST /api/auth/login, cookie nexus_session)
```
