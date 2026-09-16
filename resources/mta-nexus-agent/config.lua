-- Keep this file on the MTA server. Never publish a populated copy.
-- Create an installation key in the NEXUS dashboard and paste it below.
NEXUS_ENDPOINT = "https://nexus-mta.com/api/server/installations/heartbeat"
NEXUS_API_KEY = ""

-- Do not set this below 30 seconds. The recommended value is one minute.
NEXUS_HEARTBEAT_INTERVAL_MS = 60000
