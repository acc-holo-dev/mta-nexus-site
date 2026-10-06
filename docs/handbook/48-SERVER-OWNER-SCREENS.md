# Server Owner — Screen Specification

Status: **OWNER-CONFIRMED / TARGET**

## 1. Server Dashboard landing

Primary live block:

- current status;
- online count;
- 24h / 7d graph;
- latest observation timestamp;
- Join clicks;
- follows;
- reviews/trust summary;
- active incidents;
- quick actions.

MTA live state is observation-backed and must not be fabricated from editorial data.

## 2. Server page builder

Use a **visual block editor** with desktop/mobile preview.

Allowed customization includes:

- block ordering;
- banners;
- colors within design constraints;
- rich media;
- custom safe sections.

Never allow arbitrary HTML/CSS/JS.

## 3. Incidents, Maintenance and Events

Owner decision: keep these as **separate sections/workflows**, not one combined timeline editor.

They may still render together on public chronology where useful, but creation/management semantics remain distinct.

## 4. Recruitment

Applications use a pipeline:

`New / Reviewing / Interview / Accepted / Rejected`

Recruitment forms support predefined safe fields plus custom questions. Applicant data is private by default.

## 5. Team and co-owners

Server team uses the **same capability engine as Organizations** rather than a separate simplified authorization model.

Possible role templates include Owner, Admin, Developer, Moderator, Support, Content, with granular permissions.

Multiple co-owners are supported. Ownership transfer is explicit and audited.

## 6. Public page modules

Server page may include:

- Overview;
- live status;
- history/statistics;
- updates/news;
- events;
- recruitment;
- team;
- media;
- reviews/trust;
- community space;
- Join CTA.

## 7. Join analytics

Join interactions may record:

- clicks;
- approximate unique users;
- source/campaign;
- internal technical attribution signals.

Tracking must remain purpose-bound. Hidden internal telemetry does not imply unrestricted third-party cross-site advertising tracking.

## 8. History visibility

Detailed server edit/ownership history is visible to owners/staff only. Public communication of meaningful changes is separate and intentional.