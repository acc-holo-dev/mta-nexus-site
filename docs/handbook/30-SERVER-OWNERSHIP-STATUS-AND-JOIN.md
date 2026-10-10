# 30. Server Ownership, Status и Join Flow

## 1. Discovery before ownership

Public MTA server существует в NEXUS независимо от регистрации владельца. Observed data остаётся фактической основой directory.

## 2. Claim method

Основной target claim proof — текущий MTA challenge/control proof.

Не добавлять DNS/file/site proof просто ради количества методов. Альтернатива появляется только при доказанной проблеме coverage/usability.

## 3. Co-owners

Server может иметь нескольких co-owners. Ownership membership хранится как relation с состояниями и audit, а не массив usernames.

Минимальные поля conceptually:

- server_id;
- principal user/org;
- ownership role;
- accepted_at;
- added_by;
- status;
- permissions overlay where needed.

## 4. Ownership transfer

Flow:

```text
Current owner initiates
  -> target accepts
  -> re-auth / step-up checks
  -> policy validation
  -> transactional ownership change
  -> audit + notifications
```

Для risky transfer может потребоваться дополнительный control challenge.

## 5. Operational posts

Server page поддерживает structured status posts:

- maintenance;
- incident;
- scheduled restart;
- event;
- resolved/update.

Каждый post имеет timestamps, author/team context и visible status.

## 6. Observed truth vs owner message

Owner может написать «maintenance», но NEXUS всё равно показывает observed server state отдельно. Нельзя выдавать editorial status за network observation.

## 7. Join Server

Primary CTA:

- safe deep-link where supported;
- copy endpoint fallback;
- visible connection info according to privacy/public policy.

Click analytics считается intent signal, не confirmed player join.

## 8. No player identity by default

Directory/server page не публикует список player names по умолчанию. Используются aggregate online/slots. Любое расширение этой политики требует отдельного privacy decision.

## 13. Round 7 — server presentation, recruitment и analytics

### 13.1 Safe customization

Claimed server owner получает широкую свободу оформления через безопасные primitives:

- block reordering;
- banner/colors;
- media;
- custom text/sections;
- predefined widgets.

Arbitrary HTML/CSS/JS не допускается как обычная customization feature из-за XSS, impersonation, accessibility и long-term compatibility risks.

### 13.2 Recruitment forms

Server/Organization может строить recruitment/application forms из approved field types и custom questions. Ответы private by default, имеют retention/delete policy и role-scoped access.

### 13.3 History visibility

OWNER DECISION: история page edits и ownership changes видна **только owners/staff**, а не является публичным changelog по умолчанию. Публичные события/announcements существуют отдельно.

### 13.4 Join analytics

Owner analytics может учитывать:

- clicks;
- approximate unique users/sessions;
- source/referrer/campaign;
- first-party technical telemetry, в том числе не показываемую самому посетителю как отдельный UI signal.

Однако hidden telemetry не означает undisclosed surveillance: сбор должен быть описан в Privacy/Cookie/analytics policy, минимизирован, защищён retention rules и consent/legal requirements там, где они применимы. Third-party/cross-site identifiers не являются автоматическим default только потому, что аналитика невидима в UI.

## 14. Implemented managed-server workspace

`/workspace/servers` provides the authenticated account's personal and
organization-managed listings in bounded pages with RU/EN search, visibility,
listing-status and ownership-verification filters. Organization owners and
members with owner/admin roles or `manage_servers` see their organization
servers. A creator named in `owner_id` on an organization server still needs
that organization grant. Listing and editing use the existing ownership model;
co-owner membership and ownership transfer described above remain future work.

The overview shows four recently updated cards and an exact total. Its live
metrics describe those displayed cards, while the complete list supports all
pages. Private cards lead to authorized management. Listing maintenance and
observed network availability are displayed separately; unavailable observations
remain unknown. Page reads do not issue claims or modify ownership. Management
routes recheck current access whenever an edit is requested.

## 15. Implemented private listing activity

Authorized management links to `/workspace/servers/:id/activity`. This RU/EN
history shows existing server-target audit records for registration, listing
updates and issued control challenges. Each entry includes a timestamp, public
author identity when available, and an allowlist of submitted listing field names.
The field list describes a saved edit request, not a reconstructed before/after
diff. Raw details, previous/current values, IP/user-agent, credentials and challenge
tokens are not selected or rendered.

Current personal ownership or organization ownership/owner/admin/`manage_servers`
rights are checked together with activity in a read-only repeatable-read snapshot.
Platform administrators retain their management override; ordinary moderators
need a server grant. Anonymous users cannot load activity, and missing/revoked
access uses the same not-found result. There is no public history route.

Pages show twenty entries and an earlier-activity link. The cursor names a
server-scoped audit anchor; timestamp comparisons happen inside PostgreSQL so
microsecond precision and equal-timestamp ID ordering survive pagination.
A missing/deleted anchor returns an empty page with a latest-activity link.
Only recorded server-target actions are shown. Verification-target moderator
decisions, ownership transfers and historical before/after values are not part
of this first listing-history surface.
