# 26. Search, ranking, ads и personalization

## 1. Global search

Global search target охватывает:

- servers;
- resources;
- users;
- organizations;
- articles/content;
- forum topics/community spaces.

Search должен показывать тип сущности, trust context и безопасную навигацию, а не смешивать всё в один неразличимый список.

## 2. Server discovery

Default discovery использует **и ranking, и filters**.

Candidate ranking signals:

- text/query relevance;
- current online/activity;
- historical reliability;
- verified ownership;
- verified interaction reviews;
- follows;
- freshness;
- community activity;
- moderation/trust penalties.

Пользователь всегда может переключаться на понятные сортировки/filters.

## 3. Marketplace ranking

Подтверждённые signal families:

- relevance;
- sales;
- rating;
- freshness;
- update frequency;
- seller trust.

Ranking не должен давать paid placement скрыто.

## 4. Sponsored placement

OWNER-DELEGATED DECISION:

- initial model — fixed price;
- sponsored cards могут появляться внутри результатов/feed;
- только в заранее определённых слотах;
- всегда явно маркируются `Sponsored`/`Реклама`;
- visual treatment отличает их от organic results;
- sponsored spend не меняет organic score;
- safety/trust/verification badges нельзя купить вместе с placement.

## 5. Personalization

Target recommendation inputs:

- interests;
- follows;
- browsing/interaction history;
- purchases/claims;
- server/resource categories;
- explicit preferences.

Sensitive/private signals должны минимизироваться.

## 6. Full opt-out

OWNER-DELEGATED DECISION: пользователь может полностью отключить personalization.

Fallback experience:

- recent;
- trending based on aggregate real data;
- category filters;
- explicit sort;
- no behavior-profile ranking.

## 7. Explainability

Не обязательно раскрывать anti-abuse weights, но UI должен объяснять тип причины рекомендации:

- «Вы подписаны на автора»;
- «Похожее на ресурсы, которые вы смотрели»;
- «Популярно сейчас»;
- «Sponsored».

## 8. Anti-manipulation

Rankings need controls against:

- fake downloads/purchases;
- review rings;
- follow farming;
- rapid low-quality update spam;
- paid traffic masquerading as organic popularity;
- coordinated server-review manipulation.
