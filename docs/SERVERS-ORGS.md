# Серверы и организации — предметный контракт

**Статус:** living · предметный контракт (серверы / организации).  
**База DOC-05:** `385e577e7443cf7d7b817419ce5c3b8afe87b690` (главы 24/30/31/48/49 в Git).  
**Не активирует** платежи, co-owner transfer, page builder и полный messaging-продукт.

Смежное: [COMMERCIAL-FUTURE](COMMERCIAL-FUTURE.md), [TRUST-STAFF](TRUST-STAFF.md), [FLOWS](FLOWS.md), [UX-CONTRACT](UX-CONTRACT.md), [COMMUNITY](COMMUNITY.md).

| Метка | Значение |
| ----- | -------- |
| **Runtime** | Код/миграции на базе сверки ≠ production deploy |
| **Цель** | Owner target |
| **Предложение** | Без отдельной команды не строить |
| **Live unknown** | Нужны свидетельства среды |

## Цель

Публичный сервер из MTA master list существует в NEXUS **независимо** от регистрации владельца. Discovery не ждёт claim.

## Два слоя (инвариант)

1. **Raw MTA directory entry** — адрес, aggregate online/slots, observed online/offline/unknown.  
2. **NEXUS managed server profile** — после proof of control: оформление, команда, новости, набор. Editorial **никогда** не подменяет live observation.

```text
Observed → Public unclaimed → Claim challenge → Proof → Moderation → Managed
  → Optional Verified Server (≠ control proof; trust не покупается)
```

Owner statement («maintenance») **не** переопределяет observed online/offline/unknown. Неизвестное число игроков ≠ 0 / offline.

## Акторы и claim

| Тема | Runtime | Цель |
| ---- | ------- | ---- |
| Challenge/control proof (MTA) | Да; `X-Nexus-Actor-Id`; token только в памяти страницы | Основной метод; DNS/file — только при доказанной проблеме coverage |
| Co-owners relation + audited transfer | Нет | Explicit accept + step-up; не PATCH `ownerId` |
| Org claim lifecycle | Да | Rights at challenge/consume/approve; revoked grant не завершает следующий write |
| Org approval | Сохраняет **organization** ownership; никогда не делает менеджера personal owner | — |
| Scope в challenge | Новый challenge пишет org или personal; смена org инвалидирует старый proof | Старые pending без scope snapshot → reject + новый proof |

На публичной org server page **нет** personal ownership claim controls.

## Happy path (runtime workspace)

| Путь | Правило |
| ---- | ------- |
| `/workspace/servers` | Personal + org-managed listings; filters; org members с owner/admin/`manage_servers` |
| `POST /api/servers` | `X-Nexus-Actor-Id` + `X-Nexus-Creation-Nonce` (32 hex); recovery via nonce; unknown result ≠ proof of failure |
| Activity `/workspace/servers/:id/activity` | Private audit; 20-row cursor; no tokens/IP/before-after; owners/staff only (**цель** history visibility) |
| Join / Connect / Copy | Intent ≠ proven participation (FLOW-16) |
| Org create | Actor-Id + Creation-Nonce + recovery endpoint |

Page reads не выдают claims и не меняют ownership. Management routes перепроверяют доступ на каждый edit. Listing maintenance и observed availability — **раздельно**.

## Join, privacy, analytics

| Правило | Статус |
| ------- | ------ |
| Сильный Join + copy fallback | **Цель** |
| Не публиковать live player names по умолчанию | **Цель** |
| Aggregate online/slots | Directory default |
| Hidden telemetry ≠ undisclosed surveillance | Policy + retention + consent где нужно |
| Third-party cross-site IDs | Не default |

## Team / page / recruitment / trust (**цель**)

- Public titles ≠ 1:1 internal permissions; тот же capability engine, что Organizations.
- Safe page builder: blocks/media/text; **arbitrary HTML/CSS/JS запрещён**.
- Recruitment pipeline: New → Reviewing → Interview → Accepted / Rejected; answers private by default.
- Trust: **не** одна star-rating; reviews + availability + ownership + moderation (FLOW-18: follow ≠ игровая сессия).
- Server Pro / promotion — **цель/proposal** к активации; trust не покупается ([COMMERCIAL-FUTURE](COMMERCIAL-FUTURE.md)).
- Factions/clans / full community space на странице — **предложение**; org ≠ readiness ([COMMUNITY](COMMUNITY.md)).

Incidents / Maintenance / Events — **отдельные** workflows (на публичной хронологии могут рендериться вместе).

## Organization

**Цель:** studio / server team / commercial / community / mixed. Несколько org на пользователя. Context switch в `/workspace` меняет Resources/Servers/Billing/Support/Members/Audit вместе.

| Тема | Runtime | Цель |
| ---- | ------- | ---- |
| Create org + recovery | Да | — |
| Role templates over capabilities | Частично | Owner/Admin/Developer/Support/Finance/Content; auth by **capabilities** |
| Invites + links | Частично | Expiry, max uses, revoke, audit |
| Public storefront | Частично | Identity, public members/resources/servers/content |
| Org as commercial principal | Нет в free beta | Billing profile принадлежит Org; finance section отдельно; KYC до activation |

Critical actions → re-auth + audit: ownership transfer, payout destination, Finance grant, permanent delete.

## Messaging policy ≠ Groups/DM product

**Цель policy:** Message Request для незнакомцев; contextual OK для support/deal/org/server team/staff. Block не прячет обязательные dispute/audit notices.

**Инвариант:** policy ≠ готовый DM/groups продукт. Voice/video native **out of scope**.

## Сводка границ

| Тема | Состояние |
| ---- | --------- |
| Raw directory vs managed profile | Инвариант + цель |
| Workspace listings / activity / org proof | Runtime (PG/browser/prod — live unknown) |
| Co-owners + audited transfer | Цель |
| Join intent ≠ participation | Цель + FLOWS copy path |
| Page builder / recruitment / Server Pro | Цель; HTML запрещён |
| Org billing/payouts | Цель → COMMERCIAL-FUTURE; не free beta |
| Groups/DM/calls / factions calendar | Proposal / out of native calls |

## Источники

Исторический смысл глав 24/30/31/48/49 — в Git @ `385e577e…`. Актуальный контракт — этот файл после DOC-04.
