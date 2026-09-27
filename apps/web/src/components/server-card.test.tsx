import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Server } from "@nexus/domain";
import { ServerCard } from "./server-card";

const editorial = {
  id: "s1",
  slug: "example",
  name: "Example server",
  status: "active",
  currentPlayers: 22,
  maxPlayers: 32,
} as Server;
const observed = { address: "203.0.113.5", port: 22003, players: 7, maxPlayers: 32 };

describe("server card observation authority", () => {
  it("never advertises stored editorial player counts as live data", () => {
    const html = renderToStaticMarkup(createElement(ServerCard, { server: editorial, locale: "en" }));
    const russian = renderToStaticMarkup(createElement(ServerCard, { server: editorial, locale: "ru" }));
    expect(html).toContain("Unknown");
    expect(html).not.toContain("22 / 32");
    expect(russian).toContain("Неизвестно");
  });

  it("shows fresh official counts and drops them when the snapshot is stale", () => {
    const fresh = renderToStaticMarkup(createElement(ServerCard, { server: editorial, observation: observed, locale: "en" }));
    const stale = renderToStaticMarkup(createElement(ServerCard, { server: editorial, observation: observed, isStale: true, locale: "en" }));
    expect(fresh).toContain("Online");
    expect(fresh).toContain("7 / 32");
    expect(stale).toContain("Unknown");
    expect(stale).not.toContain("7 / 32");
  });
});
