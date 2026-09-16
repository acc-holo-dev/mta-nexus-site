import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const agentRoot = path.resolve(process.cwd(), "resources/mta-nexus-agent");

function readAgentFile(name: string) {
  return readFileSync(path.join(agentRoot, name), "utf8");
}

describe("MTA NEXUS agent contract", () => {
  it("loads a server-only config and heartbeat script", () => {
    const meta = readAgentFile("meta.xml");

    expect(meta).toContain('<script src="config.lua" type="server"');
    expect(meta).toContain('<script src="server.lua" type="server"');
  });

  it("uses an HTTPS endpoint and sends the required heartbeat fields", () => {
    const config = readAgentFile("config.lua");
    const script = readAgentFile("server.lua");

    expect(config).toContain('NEXUS_ENDPOINT = "https://');
    expect(script).toContain('apiKey = NEXUS_API_KEY');
    expect(script).toContain("currentPlayers = getPlayerCount()");
    expect(script).toContain("maxPlayers = getMaxPlayers()");
    expect(script).toContain('method = "POST"');
    expect(script).toContain('["Content-Type"] = "application/json"');
  });

  it("does not put an installation secret in the committed default config", () => {
    const config = readAgentFile("config.lua");

    expect(config).toContain('NEXUS_API_KEY = ""');
  });
});
