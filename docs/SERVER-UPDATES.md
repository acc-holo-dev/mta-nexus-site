# Server update feed

SERVER-006 exposes moderated, server-linked publications on the public server detail page.

## Included content

The feed reads only published content linked to the server with one of these types:

- article;
- news;
- devlog;
- update;
- announcement.

Published `post` and `question` records are deliberately excluded. Those community topic types can be created directly by ordinary signed-in users, so presenting them as official server updates would overstate their provenance.

## Query boundary

The repository:

- requires the exact `serverId`;
- requires `status=published`;
- limits content types to the moderated update set above;
- orders by publication/update recency;
- caps the public feed at 12 records; the detail page requests 6.

Draft or archived content never appears.

## Detail-page behavior

After the server editorial profile is resolved, NEXUS reads:

- the official MTA directory snapshot;
- the server update feed;

in parallel.

The two surfaces fail independently. A directory outage does not hide published updates, while a content read failure does not hide live status.

The UI distinguishes:

- no updates published yet;
- update feed temporarily unavailable;
- one or more moderated published updates.

Each item links to its normal published `/articles/:slug` page.

## Relationship to server follows

SERVER-006 itself does not require following a server.

SERVER-005 can notify followers when moderator-approved server-linked content becomes published. SERVER-006 then exposes the same class of moderated content directly on the server page.

Online/offline alerts remain outside this feature.
