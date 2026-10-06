# 19. Community, content и retention

> Статус: confirmed target direction through owner review v0.5; detailed policy/UX remains iterative.

## 1. Goal

Community должен быть большим и давать пользователю много полезных причин оставаться и возвращаться в NEXUS. Retention строится через реальную MTA-ценность, а не искусственный engagement.

## 2. Target surfaces

- global forum;
- server discussions;
- resource discussions/support;
- articles/guides;
- ecosystem news;
- creator devlogs;
- server updates/changelogs;
- activity feed;
- follows/notifications;
- events/contests;
- direct messages by first commercial version.

## 3. Entity-linked graph

Topic/article/update/event может быть связан с User, Organization, Server, Resource/Product, Version/Release или Event. Community не должен быть отдельным изолированным форумом.

## 4. Moderation modes

Некоторые content/discussion types должны проходить pre-moderation. Policy assigns explicit mode: `pre_moderated`, `post_moderated`, `trusted_auto_publish`, `staff_only`, `organization_managed` with platform override.

## 5. Feed quality

Rank meaningful activity by follows, ownership, discussions, verified updates, guides, language, mute/block and moderation quality. Sponsored items only as clearly labeled inventory.

## 6. Events/contests

Support community/server/resource/dev competitions and official NEXUS events with archive/results and anti-abuse voting policy where applicable.

## 7. Direct messages by first commercial version

Require block/mute, message requests, rate limits, reports, attachment safety and retention/privacy policy.

## 8. Metrics

Prefer weekly active community members, returning users, meaningful sessions, answered threads, discovery conversion, creator retention and successful updates/purchases over raw page views.


## 9. Round 3 community ownership and moderation

### 9.1 Managed spaces

DECISION: verified/authorized server owners and organizations may create their own community spaces/subforums, choose local moderators within granted capabilities and structure their discussions. NEXUS retains platform-wide safety/moderation override and audit.

### 9.2 Pre-moderation matrix

DECISION: at minimum the following categories are candidates for mandatory pre-moderation at launch policy level:

- advertising/promotional submissions that enter controlled inventory or editorial areas;
- submissions to homepage/editorial spotlight;
- first publications from new/untrusted accounts;
- long-form articles/guides;
- server news intended for broader discovery surfaces;
- creator devlogs intended for broader discovery surfaces.

Routine forum discussion may use post-moderation plus anti-abuse/rate limits unless risk rules trigger review.

### 9.3 Anti-abuse for new accounts

DECISION: new/low-trust accounts receive progressive limits for DMs, topics, comments, reviews, resource submissions and other abuse-sensitive actions. Limits should relax based on verified activity/trust rather than simply paying for a subscription.

### 9.4 Multi-channel notifications

Target notification channels: in-app, email, Web Push, Telegram and Discord. Integrations must respect user preferences, rate limits and security/privacy policy.

## 18. Round 4 social scope

К первой коммерческой версии нужны:

- direct messages;
- independent groups/clans;
- server/org community spaces;
- Markdown + code + images/files + safe embeds;
- polls;
- reactions;
- mentions;
- bookmarks;
- events/contests для eligible actors;
- achievements/levels/seasonal community awards.

Trust/verification badges и platform enforcement labels не смешиваются с achievements: achievement можно заработать участием, но нельзя считать доказательством identity/commerce safety.

### Daily-return loop

Главный daily surface — персонализированная смесь:

`news/content + servers + marketplace + community + notifications`

Пользователь может отключить personalization и получить neutral recent/trending/filter-based experience.


## Round 9 owner sync — content moderation by trust

The content system uses progressive moderation rather than one policy for every author:

- the first forum topic from a new account is premoderated;
- a healthy history may move normal forum publishing to immediate publish + post-moderation;
- low/new-trust articles and guides are premoderated;
- established healthy authors may publish articles/guides immediately with post-moderation/reporting;
- claimed-server news/devlogs may publish immediately when the account/server has no active risk flags;
- events/contests are limited to eligible actors and may still receive selective moderation;
- all paid advertising/featured content requires content-policy review before display;
- reputation may raise quotas, but all major surfaces retain limits and abuse controls.