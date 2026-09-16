local AGENT_VERSION = "0.1.0"
local DEFAULT_INTERVAL_MS = 60000
local MINIMUM_INTERVAL_MS = 30000

local heartbeatInFlight = false
local configurationWarningShown = false

local function isConfigured()
    return type(NEXUS_ENDPOINT) == "string"
        and NEXUS_ENDPOINT:find("^https://") ~= nil
        and type(NEXUS_API_KEY) == "string"
        and #NEXUS_API_KEY >= 10
end

local function heartbeatComplete(_, responseInfo)
    heartbeatInFlight = false

    if not responseInfo or not responseInfo.success then
        local statusCode = responseInfo and responseInfo.statusCode or "unknown"
        outputDebugString("[mta-nexus-agent] Heartbeat failed (status " .. tostring(statusCode) .. ").", 2)
    end
end

local function sendHeartbeat()
    if heartbeatInFlight then
        return
    end

    if not isConfigured() then
        if not configurationWarningShown then
            outputDebugString("[mta-nexus-agent] Configure an HTTPS endpoint and installation API key before starting this resource.", 2)
            configurationWarningShown = true
        end
        return
    end

    local payload = toJSON({
        apiKey = NEXUS_API_KEY,
        status = "online",
        currentPlayers = getPlayerCount(),
        maxPlayers = getMaxPlayers(),
        moduleVersion = AGENT_VERSION,
    })

    if not payload then
        outputDebugString("[mta-nexus-agent] Could not serialize heartbeat payload.", 1)
        return
    end

    -- MTA wraps toJSON output in an array; the NEXUS API expects a JSON object.
    payload = string.sub(payload, 2, -2)

    heartbeatInFlight = true
    local request = fetchRemote(NEXUS_ENDPOINT, {
        queueName = "mta-nexus-heartbeat",
        connectionAttempts = 2,
        connectTimeout = 5000,
        method = "POST",
        postData = payload,
        headers = {
            ["Content-Type"] = "application/json",
            ["Accept"] = "application/json",
        },
    }, heartbeatComplete)

    if request == false then
        heartbeatInFlight = false
        outputDebugString("[mta-nexus-agent] Could not start heartbeat request.", 2)
    end
end

addEventHandler("onResourceStart", resourceRoot, function()
    local interval = math.max(MINIMUM_INTERVAL_MS, tonumber(NEXUS_HEARTBEAT_INTERVAL_MS) or DEFAULT_INTERVAL_MS)

    outputDebugString("[mta-nexus-agent] Started v" .. AGENT_VERSION .. ".", 3)
    setTimer(sendHeartbeat, 1000, 1)
    setTimer(sendHeartbeat, interval, 0)
end)
