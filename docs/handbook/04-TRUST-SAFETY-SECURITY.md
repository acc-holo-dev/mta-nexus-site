# 04. Trust, Safety и Security

## 1. Зачем доверие является частью продукта

Для MTA NEXUS доверие — не отдельная страница с зелёной галочкой. Оно должно проявляться в каждом критическом действии:

- сервер показывает наблюдаемое состояние, а не рекламное обещание;
- владение сервером подтверждается proof workflow;
- ресурс нельзя публично скачать без безопасного build state;
- пользователь понимает, кто автор и кто текущий owner;
- moderation decision имеет причину и след в audit;
- повтор запроса не создаёт дубликаты и не меняет деньги/права несколько раз;
- приватные данные не становятся публичными ради «красивой статистики».

## 2. Базовая модель доверия

Доверие в NEXUS складывается из независимых сигналов:

1. **Identity evidence** — кто выполняет действие.
2. **Ownership evidence** — имеет ли actor право на конкретный объект.
3. **Source evidence** — откуда пришли live-данные.
4. **Artifact evidence** — какой файл был загружен и проверен.
5. **Moderation evidence** — кто и почему принял решение.
6. **Audit evidence** — что действительно произошло.
7. **Integrity evidence** — совпадает ли выдаваемый файл с сохранённой metadata.

Ни один бейдж не должен подменять все эти уровни.

## 3. Resource safety invariant

CURRENT и non-negotiable.

Build публично downloadable только если одновременно:

```text
status = published
scanStatus = clean
scanner != empty
scannedAt != null
```

Эта проверка должна быть одинаковой в:

- public build listing;
- latest build resolver;
- moderation fallback;
- product restoration;
- free claim;
- HTTP download.

Download route повторяет проверку как defense in depth.

## 4. Fail-closed malware scanning

CURRENT.

### Требования

- upload ограничен размером;
- отсутствие `Content-Length` не должно обходить лимит;
- ClamAV работает по INSTREAM;
- incomplete scan не считается clean;
- scan timeout/error не превращается в success;
- clean state сохраняет scanner identity и time;
- production scanner configuration не должна использовать опасные dev defaults.

### Почему это важно для пользователя

Trust message должен быть честным:

> «Эта версия прошла проверку указанным scanner pipeline и с тех пор хранится под контролем платформы.»

Не:

> «Файл абсолютно безопасен.»

Антивирусная проверка уменьшает риск, но не является математической гарантией отсутствия вредоносной логики.

## 5. SHA-256 и artifact integrity

CURRENT.

Для build хранится metadata файла, включая SHA-256 и size.

Перед public/reviewer delivery локальный storage:

- открывает конкретный file handle;
- проверяет metadata;
- считает SHA-256;
- сравнивает hash/size с DB;
- только после этого начинает выдачу.

Same-size corruption также должна быть обнаружена.

Ошибка integrity возвращается как private failure, а не как битый download.

## 6. Immutable storage keys и atomic upload

CURRENT.

Asset key генерируется платформой и не строится напрямую из original filename.

Upload:

1. пишет во временный private file;
2. flush/close;
3. публикует атомарно;
4. никогда не перезаписывает существующий key;
5. удаляет temp при обработанной ошибке.

Existing key conflict — ошибка, даже если bytes совпадают.

Это уменьшает риск гонок и silent replacement.

## 7. Download cancellation

CURRENT.

Отмена HTTP/client request должна распространяться в storage path.

- hashing проверяет abort между блоками;
- stream закрывается;
- listener cleanup обязателен;
- при отмене до response delivery используется private 499 semantics;
- уже записанный `download_started` audit не должен интерпретироваться как доказательство полного скачивания.

## 8. Ownership security

### Server ownership

CURRENT.

Наличие IP:port в MTA directory не даёт права редактировать server object.

Claim challenge:

- имеет ограниченный срок;
- хранит digest, а не reusable plain secret;
- защищён от одновременных активных дублей;
- proof и verification relation связаны;
- consumed и revoked terminal states взаимоисключающие.

### Resource ownership

CURRENT.

Author management scope определяется актуальным personal/org ownership.

Historical author не должен сохранять доступ после переноса объекта в организацию, если больше не имеет membership/permission.

## 9. Authorization

CURRENT.

Authorization должна учитывать:

- actor identity;
- active context;
- direct ownership;
- organization membership;
- organization role;
- explicit permissions;
- target state;
- operation-specific policy.

### Запрещённый anti-pattern

```text
if (record.authorId === user.id) allowForever()
```

если current ownership уже изменён.

## 10. Session security

CURRENT foundation.

- server-side session validation;
- session revocation;
- recovery flows;
- account verification;
- password reset tokens с одноразовой семантикой;
- rate limits;
- защита от first-use concurrency races;
- secure secret handling;
- приватные routes не должны случайно становиться cacheable публичным CDN/browser cache.

## 11. Mail security

CURRENT operational area.

Recovery email worker поддерживает:

- TLS policy;
- секреты из безопасных источников;
- retry/attempt tracking;
- exhausted/discard audit;
- graceful shutdown;
- fail-closed поведение при отсутствии необходимых ключей.

Email delivery failure нельзя путать с успешностью/неуспешностью той DB-транзакции, которую письмо лишь уведомляет.

## 12. Reports и moderation

CURRENT.

### Report safety

- reporter identity хранится приватно согласно policy;
- evidence links валидируются;
- invalid legacy links не рендерятся как clickable trusted links;
- report не является публичным verdict;
- notification failure не отменяет уже сохранённую complaint.

### Moderation safety

- queue bounded/paginated;
- old pending work видно через total count;
- decision требует context;
- stale double decision → conflict;
- audit и state transition должны быть согласованы;
- moderator download path также проверяет artifact integrity.

## 13. Verification

CURRENT.

Verification должна подтверждать конкретное свойство, а не общую «хорошесть» субъекта.

Примеры:

- Verified Server = подтверждённое владение/контроль по принятой policy;
- Verified Developer = identity/property, определённое отдельной policy;
- Verified Organization = проверена соответствующая организация.

Нельзя использовать одну галочку так, будто она означает одновременно безопасность файлов, честность продавца, качество сервера и отсутствие нарушений.


## 13.1 Evidence-backed badges — target

OWNER DECISION: развивать независимые trust signals, включая `Verified User`, `Verified Developer`, `Verified Server`, `Verified Organization`, `Verified Seller`, `Clean Build`, `DRM Protected`, `Verified Purchase Review`, `Verified Server Interaction`, `Official/Staff`, если конкретный badge имеет ясный смысл.

**Verification нельзя купить.** Она выдаётся по evidence: подтверждённому контролю, опыту, истории выполненных заказов/продаж или другим критериям конкретного badge. Оплата не заменяет доказательство.

## 13.2 Auto-publish safety boundary

OWNER DECISION: subscription auto-publish может убрать ожидание ручной moderation queue, но malware scan, artifact integrity, storage safety, authorization и обязательные automated policy checks выполняются всегда.

## 14. Privacy by default

DECISION.

Не публиковать без необходимости:

- private account data;
- email;
- sessions;
- buyer identities;
- internal server config;
- hidden resource relations;
- security metadata;
- storage keys;
- moderation internals;
- secrets;
- fraud signals;
- raw player tracking.

LEGACY принцип из MTA Market сохраняет ценность:

> Не показывай то, на раскрытие чего владелец не соглашался.

## 15. External links

CURRENT.

Organization/server/media/article/report links используют общий HTTP(S)-only browser-link policy.

Он блокирует, например:

- credentials in URL;
- control chars;
- whitespace;
- backslashes;
- oversized URLs;
- unsupported schemes.

Важно: это policy публичной ссылки, а не полноценная SSRF-защита и не гарантия доверенности удалённого сайта.

## 16. Audit semantics

CURRENT.

Audit event name должен описывать только то, что действительно известно.

Пример:

- response подготовлен → `download_started`;
- нельзя писать `download_completed`, если сервер не знает, сохранил ли пользователь файл.

Это принцип для всего проекта: audit не должен преувеличивать факт.

## 17. Trust signals в UI

Пользователь должен видеть не просто «Verified», а понятные сигналы:

- источник live state;
- когда обновлялось наблюдение;
- статус ownership;
- статус build moderation;
- scan state;
- scanner/time при необходимости;
- version;
- author/organization;
- decision/review status;
- понятную причину, почему действие недоступно.

## 18. Legacy trust ideas

LEGACY INTENT, не CURRENT:

- Verified Seller;
- verified interaction reviews;
- seller deposit;
- guarantee deal;
- dispute escrow lifecycle;
- leak radar;
- forensic watermark;
- public trust hub;
- controlled blacklist;
- DRM license health;
- live demo/test drive.

Каждый из этих механизмов требует отдельной threat model и юридической оценки.

## 19. AI и безопасность

DECISION/strong recommendation.

AI может помогать:

- суммировать moderation evidence;
- предлагать текст changelog;
- переводить copy;
- классифицировать очередь как assistive signal;
- объяснять технические ошибки.

AI не должен автономно:

- объявлять файл безопасным;
- банить/верифицировать пользователя без policy;
- завершать финансовый dispute;
- принимать irreversible moderation decision;
- обходить server-side authorization.

## 20. Почему пользователю стоит доверять NEXUS

Доверие должно объясняться не рекламой, а системой:

1. публичные серверные данные имеют источник;
2. ownership подтверждается;
3. ресурс имеет traceable build lifecycle;
4. build проверяется перед публикацией и перед выдачей;
5. hash связывает DB metadata и bytes;
6. модерация имеет историю;
7. retries и concurrency не должны создавать скрытые дубли;
8. приватность является default;
9. интерфейс не обещает больше, чем подтверждает backend;
10. platform operator сохраняет backup/recovery и release evidence.


## 18. Round 3: sanctions, public trust states and appeals

### 18.1 Graduated sanctions

DECISION: platform supports a graduated and capability-aware enforcement ladder:

`warning -> content action -> feature/capability restriction -> temporary suspension -> permanent ban`

The exact step is risk/evidence dependent; staff does not have to mechanically pass every earlier step for fraud, malware, account compromise or other severe cases.

### 18.2 SCAM / BLACKLIST state

DECISION: NEXUS may visibly mark an account, seller, organization, resource or other supported entity as `SCAM` / `BLACKLIST` when the platform has reached a documented moderation/trust decision.

This is **not** an uncontrolled wall of accusations. A public high-severity label requires:

- identified subject and case;
- evidence/provenance;
- staff decision and actor audit;
- reason code + substantive explanation;
- decision timestamp/status;
- appeal path;
- revocation/update mechanism when facts change.

User reports are inputs to investigation, not the public verdict themselves.

### 18.3 Transparency

DECISION: moderation and enforcement should show the full substantive reason publicly where the decision is public. A safety redaction is permitted only for secrets, personal data, legally protected information, exploit details or information that would materially help evade abuse detection. Redaction must not turn the reason into meaningless boilerplate.

### 18.4 Appeals

DECISION: NEXUS needs first-class appeals for moderation, sanctions/bans, verification decisions and eligible dispute/platform decisions. Appeal is a separate case/event, not a silent overwrite of history.

Recommended states: `submitted -> triage -> under_review -> upheld | modified | overturned -> closed`.

The reviewer should not be the same actor who made the original decision when practical for high-severity cases.

## 19. Reputation as signals, not purchasable status

DECISION: trust/reputation is based on multiple independent evidence-backed signals rather than one opaque paid score. Examples include account age, completed transactions, verified purchases, resource ratings, server interactions, fulfilled work, moderation history, verified identities/ownership, response behavior, portfolio and public project history.

Commercial entitlements may improve tooling and visibility but may never directly purchase `Verified`, erase violations or fabricate reputation evidence.

## 25. Round 4 trust consequences

### Permanent enforcement until review

`SCAM` / `BLACKLIST` verdict не истекает автоматически. Он действует до отмены или изменения по appeal/review. Это предотвращает автоматическое «обнуление» серьёзного enforcement только из-за течения времени.

### Transparency

NEXUS должен иметь public Transparency surface с агрегированными показателями, например:

- enforcement actions;
- appeals and outcomes;
- SCAM/blacklist decisions;
- malware/unsafe build blocks;
- marketplace disputes/refunds;
- verification decisions.

Публиковать нужно статистику и методологию, но не PII, secrets, private evidence или детали, помогающие обходить security controls.

### Reviews/ranking

Server reputation не сводится к одной пользовательской star-rating. Target signal set: verified interaction reviews, current activity/uptime observations, follows, ownership verification, moderation history и другие evidence-backed signals. Один сигнал не должен давать безусловный trust verdict.

## 26. Round 6 — quarantine, incident outreach and account security

### Quarantine

Staff needs a quarantine action that immediately stops new downloads/activations for a suspicious build without destroying the artifact. Quarantine preserves evidence, audit and reversibility while the investigation runs.

### Malware outreach

Confirmed malware response includes notifying users who downloaded the affected build. Takedown alone is insufficient because exposure already happened downstream.

### Security Center

Target account security includes sessions, devices/session metadata, login history, 2FA, recovery codes, session revoke and security alerts.

2FA is strongly encouraged for high-value accounts but is **not mandatory solely because of Seller/Server Owner/Organization Finance/Staff role**. Sensitive actions may still require re-auth/step-up under risk or provider policy.

### Finance/debug separation

Normalized payment events are the default finance UI. Raw provider payloads require a distinct restricted capability and should be audited.


## Round 9 owner sync — public trust and limit policy

A public Trust/Reputation surface is now approved. It is not a single score. It may show verified identities/badges, exact counts of completed sales/deals, verified reviews, account history signals and finalized public moderation history. Internal notes, private evidence, payment details, raw anti-abuse signals and security-sensitive data remain restricted.

Historical public moderation records are retained even after an active warning expires or is lifted. The public record should distinguish `active`, `expired`, `overturned`, `appealed` and similar states rather than silently erasing history.

High trust does not mean unlimited access. Rate limits/quotas continue to exist across communication, content, financial and security-sensitive actions. Trust may adjust limits where safe but cannot bypass hard safety/finance controls.