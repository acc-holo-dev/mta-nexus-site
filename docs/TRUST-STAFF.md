# Доверие, безопасность, staff и аккаунт

**Статус:** living · предметный контракт (доверие / staff / аккаунт).  
**База DOC-05:** `385e577e7443cf7d7b817419ce5c3b8afe87b690`.  
Полный текст решений — [13-DECISION-REGISTER](handbook/13-DECISION-REGISTER.md); NX — [DECISIONS](DECISIONS.md).  
Ops mail/ClamAV/recovery — только [OPERATIONS](OPERATIONS.md). DM/groups product — [COMMUNITY](COMMUNITY.md).

| Метка | Значение |
| ----- | -------- |
| **Runtime** | Код/схема на SHA ≠ production deploy |
| **Цель** | Owner target |
| **Предложение** | Без отдельной команды |
| **Live unknown** | Нужны свидетельства среды |

## Жёсткие инварианты

- Сессию, роль, принадлежность и capability проверяет **сервер**; скрытая кнопка ≠ проверка.
- Приватные данные, внутренние ошибки, секреты, raw evidence и provider payloads **не** в публичные DTO/логи/отчёты.
- Критическое изменение + обязательный аудит — **атомарны**.
- Critical staff → fresh-auth / step-up (минимум `staff_action` → `current_password`).
- **2FA добровольна**; не становится обязательной только из‑за роли Seller / Server Owner / Org Finance / Staff.
- Подписка **не** выдаёт staff-права, **не** отменяет санкции и **не** обходит quarantine/malware.
- Finance access ≠ automatic moderation; raw provider — restricted capability + audit.

## Цель

Единый контракт ролей, auth/lifecycle, verification/reputation, quarantine, moderation/sanctions/appeals, staff casework и privacy границ для trust/security.

## Акторы и полномочия

**Runtime roles** в `users.role`: `user`, `developer`, `server_owner`, `moderator`, `admin`.

| Контекст | Граница |
| -------- | ------- |
| Гость | Public surfaces; без private library/evidence/manage |
| Пользователь | Свой аккаунт/сессии/разрешённые взаимодействия |
| Автор / server owner / org | Только текущие права; историческое авторство не сохраняет доступ после transfer |
| Staff | Capability над областью; reason/evidence/audit по операции |

**Цель:** staff-полномочия накапливаются (capability grants), не один взаимоисключающий enum: Support, Community, Resource/Server, Verification, Finance/Disputes, Security/Trust, Admin. Seller/Buyer — сценарии, не отдельные аккаунты.

Чтение / изменение / финансы / private evidence проверяются **отдельно**. Критические изменения повторно проверяют права в транзакции.

## Семантика доверия

| Факт | Значение |
| ---- | -------- |
| Control proof | Управление endpoint; ≠ качество / universal approval |
| Verification | Evidence-backed claim; пересматриваемо; **нельзя купить** |
| Review | Eligible interaction; negative legitimate не снимается seller complaint |
| Reputation | Multi-signal; не один платный opaque score |
| Report | Вход в расследование ≠ публичный вердикт |
| Malware clean | Конкретная проверка; ≠ абсолютная безопасность |

Публичный build: published + clean scan (scanner id + time). Timeout/absent scanner ≠ clean. Файлы приватны; size/SHA при передаче; integrity fail блокирует выдачу.

## Аккаунт и auth

| Тема | Runtime | Цель |
| ---- | ------- | ---- |
| Login | Email + password | Social ≠ login providers |
| Email verification gate | Частично | Почти все state-changing public actions |
| Security Center / sessions / recovery | Частично | Full center + Activity log |
| 2FA | Optional | Recommend for high-risk; не блок базовой роли |
| `staff_action` → `current_password` | Да (FLOW-22) | Step-up независимо от 2FA |
| Account delete | — | Archive personal-owned entities; не обязан обходить всё вручную |

Session-actor binding на tip — [PROBLEMS](PROBLEMS.md). Controlled multi-connection barrier upload/download — F08 residual (**live unknown**).

## Quarantine и admin policy

**Цель Quarantine:** немедленно stop download / lease / promotion / auto-publish; артефакт не удаляется автоматом (evidence). При confirmed malware — уведомить downloaders; takedown каталога ≠ полный incident response.

**Runtime:** quarantine + report-decision + build-incident delivery с opt-in существуют; полный production coverage кэшей — **live unknown**.

| Policy | Решение владельца |
| ------ | ----------------- |
| Admin search | Permission-aware; finance/security без capability не раскрывать |
| Raw provider payloads | Restricted debug; audit open; secrets не в UI |
| Self-service API keys | Не обязательны для first commercial |
| Public anonymous API | Не открывать на первом этапе |
| Public Status Page | Не требуется сейчас; internal observability обязательна для production |

## Модерация, санкции, SCAM, апелляции

**Runtime:** reports, moderation/verification/build review, `/admin` queues.

**Цель:** специализированные departments, не один undifferentiated super-user. Case timeline append-oriented. Note audiences: `INTERNAL` | `VISIBLE_TO_AFFECTED_USER` | `PUBLIC_REASON` — conversion только explicit.

| Тема | Правило владельца |
| ---- | ----------------- |
| Sanctions ladder | warning → remove → restrict → temp ban → permanent → high-severity public trust label |
| SCAM/BLACKLIST | Controlled platform verdict; один authorized senior Trust/Admin + evidence + public reason + appeal; не crowd vote |
| Appeals | Обязательны для bans/content/verification/eligible disputes: upheld / modified / overturned |
| Financial correction | Finance capability + provider auth + re-auth + audit + idempotency; dual-control не universal invariant |
| Anti-abuse | Нет silent staff impersonation; нет blind bulk destroy; subscription не shields |

## Support concurrency (**runtime**)

- Staff `PATCH /api/support/:id`: `status` + `expectedStatus`; mismatch → `409 SUPPORT_STATUS_CONFLICT` без audit; matching no-op idempotent.
- Reply `POST /api/support/:id`: `expectedStatus`; stale → `SUPPORT_MESSAGE_CONFLICT`; closed → `SUPPORT_CASE_CLOSED`; reply on resolved может reopen атомарно.
- Create/reply/PATCH требуют `X-Nexus-Actor-Id` (428/409); list/thread возвращают `actorId` для UI check.
- Idempotency-Key (UUIDv4) + SHA-256 fingerprint; mismatch → `SUPPORT_IDEMPOTENCY_CONFLICT`; replay → 201 `replayed: true` (migration `0033_…`).
- Body ≤ 32 KiB streamed; oversized → `413 SUPPORT_BODY_TOO_LARGE`.
- Reload-safe retry keys в sessionStorage без subject/message content; 24h. Cross-tab/logout guarantee — **live unknown**.
- Limits: 5 new/hour, 30 replies/hour. Requester open↔resolved; closed — staff.

ABA `open→resolved→open` без revision token — известный остаток (**предложение** усиления).

## Privacy / Activity Log / SLA

**Цель:** Activity & Security Log для пользователя; retention/minimization по policy. Exact SLA minutes — операционно / **live unknown**, не публичный marketing contract. Messaging abuse boundaries только здесь; product DM — COMMUNITY.

## Очереди staff (**цель**)

Минимум: Critical Malware/Security → Payment/Settlement → SCAM/Trust → Appeal → Normal Content. Case detail: summary | evidence+timeline | action/reason. Exact screens — target IA, не claim runtime completeness.

## Non-goals

- Покупка verification / trust / SCAM removal / staff.
- Обязательная 2FA только из роли.
- Finance role → moderation.
- Subscription shields.
- Public accusation board.
- Переписывать OPERATIONS runbook здесь.

## Источники

Исторический смысл DOC-05 trust/staff/account глав — в Git @ `385e577e…`. Актуальный контракт — этот файл после DOC-04.
