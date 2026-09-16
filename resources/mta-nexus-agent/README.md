# MTA NEXUS Agent

A small server-side MTA resource that sends an authenticated heartbeat to MTA NEXUS. It reports only the server's online state and player capacity; it does not read player identities, serials, chat, or gameplay data.

## Install

1. Create an installation for the server in MTA NEXUS. Copy the API key shown once.
2. Copy this entire folder into the MTA server's `resources` directory.
3. Put the key in `config.lua`. Keep the endpoint on HTTPS.
4. Add `start mta-nexus-agent` to the server configuration, or start it from the MTA console.
5. Check the MTA server log for `Started v0.1.0`. The first heartbeat is sent after one second, then once per minute.

The installation key is equivalent to access for this one server's telemetry. Do not commit a configured `config.lua`, send it in chat, or expose it in screenshots. Revoke the installation and create a new one if it leaks.

## Behaviour

- Uses the MTA server APIs for current players and maximum slots.
- Makes an HTTPS `POST` request to `/api/server/installations/heartbeat`.
- Does not retry concurrently; a slow request cannot pile up on later heartbeats.
- Logs only a status code on failure, never the API key or response body.
- Does not mark the server offline on stop. The web application determines stale/offline status from the last successful heartbeat.

## Requirements

- An MTA server with `fetchRemote`, `getPlayerCount`, and `getMaxPlayers`.
- An active installation key created for the target NEXUS server.
- Outbound HTTPS access from the MTA server to the NEXUS domain.

For the HTTP contract, see [docs/API.md](../../docs/API.md).
