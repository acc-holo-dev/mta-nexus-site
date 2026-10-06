# MTA NEXUS — Home, Discover, Navigation и Feeds

> Статус: OWNER DECISION / TARGET SPEC, Round 6.

## 1. Home после login

После входа пользователь остаётся на обычной Home. Home не превращается в dashboard.

Guest и authenticated user используют одну общую information architecture. После авторизации появляются персональные modules, follow state, recommendations, notifications и доступ к Workspace.

## 2. Home layout

OWNER DECISION: Home должна использовать **конечные секции с `Показать больше`**, а не бесконечный основной scroll.

Пример balanced structure:

1. global search;
2. live MTA / server snapshot;
3. recommended/trending servers;
4. marketplace/resources;
5. community highlights;
6. news/devlogs/server updates;
7. events;
8. personalized/followed updates;
9. notifications/tasks where appropriate.

Home должна давать обзор всей экосистемы, а не превращаться в копию одной социальной ленты.

## 3. Community Feed

В отдельной Community Feed infinite scroll допустим.

Требования:

- stable cursor pagination;
- deduplication;
- permission-aware content;
- moderation/takedown propagation;
- clear sponsored/content labels;
- no fake engagement metrics;
- accessible way вернуться к предыдущей позиции where practical.

## 4. Discover

OWNER DECISION: нужна отдельная `/discover` поверхность, но **без смешанной all-entity выдачи**.

Discover даёт отдельные tabs/sections:

- Servers;
- Resources;
- People;
- Organizations;
- Content;
- Events.

Каждый раздел использует собственные filters и ranking signals. Не смешивать server/resource/person/content cards в один heterogeneous result stream. Discover остаётся cross-ecosystem entry point, но не заменяет dedicated catalogs.

## 5. Personalization

Ранее подтверждённое правило сохраняется:

- рекомендации допустимы;
- пользователь может полностью отключить personalization;
- при opt-out использовать нейтральные сигналы вроде recent/trending/category filters;
- отдельные per-item `Not interested` controls не являются обязательной функцией.

Purchases, private messages и sensitive activity не должны превращаться в публичные recommendation explanations.

## 6. Global navigation

OWNER DECISION: top-level navigation сохраняется примерно в таком виде:

- `Home`;
- `Servers`;
- `Market`;
- `Community`;
- `Messages`;
- `Notifications`;
- `Workspace` / `Profile`.

`Discover` может быть отдельным пунктом либо заметной secondary entry рядом с search; точное desktop/mobile placement является UX implementation detail, но сама поверхность обязательна.

## 7. Global Search

Global Search остаётся явной обычной функцией, без command language.

Search охватывает:

- servers;
- resources;
- users;
- organizations;
- articles;
- forum topics;
- events where indexed.

Search должен учитывать permissions, moderation state, visibility и locale.

## 8. No command UI

Подтверждено повторно: глобальные commands/command palette не нужны.

Не делать UX, где пользователь должен помнить keyboard syntax, slash commands или `Ctrl/Cmd+K` для обычной навигации.

Keyboard accessibility стандартных controls остаётся обязательной.

## 9. Notifications placement

Notifications — самостоятельная top-level surface, но Home может показывать только наиболее важные actionable items.

Не дублировать весь notification inbox на Home.

## 10. Platform status

Отдельная публичная NEXUS status page сейчас не требуется. Incidents самой платформы при необходимости можно сообщать через operational banner/announcement, но production monitoring остаётся внутренним обязательством.

## 11. Design objective

Пользователь должен понимать, что NEXUS — единая экосистема, уже по Home и navigation. Нельзя делать Market визуально единственным центром продукта или прятать Community/Servers за второстепенными ссылками.

## 11. Round 7 — mobile navigation

OWNER DECISION: mobile bottom navigation:

- Home;
- Servers;
- Market;
- Community;
- More.

`More`/header surfaces дают доступ к Messages, Notifications, Discover, Workspace/Profile, Support и settings. Unread counts могут отображаться badges без превращения navigation в бесконечную ленту alerts.