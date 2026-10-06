# 27. Messaging, groups и social systems

## 1. Direct messages

DMs нужны к первой коммерческой версии, потому что marketplace/services/community требуют приватной коммуникации.

Минимальный набор:

- 1:1 conversations;
- unread state;
- block/mute;
- report;
- attachments under strict type/size policy;
- anti-spam/rate limits;
- privacy setting: who may message;
- staff access only through defined moderation/legal process, not casual browsing.

## 2. Groups / clans

Groups/clans существуют отдельно от Organization и Server.

Это social entity для:

- игроков;
- тематических сообществ;
- кланов;
- временных команд;
- interest groups.

Не давать group автоматически commercial ownership/billing capabilities Organization.

## 3. Community editor

Target content tools:

- Markdown;
- code blocks;
- images/files;
- approved embeds;
- polls;
- reactions;
- mentions;
- bookmarks.

Все untrusted HTML/embeds/files проходят sanitize/validation policy.

## 4. Events and contests

Создание доступно только определённым eligible actors, например:

- verified server owner/team;
- organization with permission;
- approved creator;
- staff.

Exact eligibility configurable. Это не право, покупаемое одной рекламой.

## 5. Achievements and levels

Допустимы:

- participation achievements;
- creator milestones;
- server/community milestones;
- seasonal badges;
- community awards.

Они не заменяют verification/trust и не продаются как доказательство репутации.

## 6. Notifications

События могут доставляться через:

- in-app;
- email;
- Web Push;
- Telegram;
- Discord.

Пользователь управляет channels/categories, кроме минимально необходимых security/transactional notices.

## 7. Progressive anti-abuse

Новые/low-trust accounts получают ограниченные quotas на:

- DMs;
- mentions;
- posts/comments;
- reviews;
- resource submissions;
- external links/attachments.

Limits снимаются через account age, verified email/security, нормальную историю использования и policy-defined trust signals, а не только оплатой.

## 8. Round 5 — messaging policy

### 8.1 Default DM policy — delegated decision

OWNER delegated exact default. Target default:

- transaction/deal/support participants могут писать в соответствующем context без отдельного friend gate;
- members одной Organization/server team/private group могут писать согласно membership policy;
- незнакомый пользователь отправляет **Message Request**, а не сразу попадает в основной inbox;
- recipient может разрешить broader DMs в privacy settings;
- low-trust/new accounts имеют tighter quotas.

Это уменьшает spam, не ломая marketplace/services communication.

### 8.2 Block

DECISION: block является полноценной privacy/safety primitive и блокирует как минимум:

- direct messages/message requests;
- mentions;
- invites;
- targeted replies/interactions where feasible;
- появление заблокированного account в персональных рекомендациях.

Public content moderation и обязательные transaction/legal notices не должны исчезать так, чтобы ломать dispute/audit process.

### 8.3 Private groups/spaces

DECISION: поддерживаются invite-only/private groups и community spaces с role/permission model и platform moderation override.

### 8.4 No voice/video calls

OWNER DECISION: NEXUS не строит собственные voice/video calls. Для синхронной коммуникации используются внешние integrations/links (например Discord/Telegram), а продукт фокусируется на async messaging, support, deals и community.

## 13. Round 7 — messaging and outbound channel scope

На текущем target этапе official notification delivery:

- in-app;
- email;
- Web Push/PWA.

Telegram/Discord notification bots отложены. Не проектировать обязательный release dependency на bot tokens, guild membership или external messenger actions.

DM attachments разрешены ограниченно: images/text/logs/safe archives после malware scan. Executable distribution через DM запрещается как ordinary flow; marketplace/resource delivery использует собственный trusted delivery pipeline.