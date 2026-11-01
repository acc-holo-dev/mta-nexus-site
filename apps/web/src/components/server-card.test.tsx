import type { Server } from "@nexus/domain";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HomeNetworkServerCard, ServerCard } from "./server-card";

const editorial = {
  id: "s1",
  slug: "example",
  name: "Example server",
  status: "active",
  currentPlayers: 22,
  maxPlayers: 32,
  ipAddress: "203.0.113.5",
  port: 22003,
} as Server;
const observed = { address: "203.0.113.5", port: 22003, players: 7, maxPlayers: 32 };
const observedZero = { address: "203.0.113.5", port: 22003, players: 0, maxPlayers: 32 };
const observedUnknownPlayers = { address: "203.0.113.5", port: 22003, maxPlayers: 32 };

describe("server card observation authority", () => {
  it("never advertises stored editorial player counts as live data", () => {
    const html = renderToStaticMarkup(
      createElement(ServerCard, { server: editorial, locale: "en" }),
    );
    const russian = renderToStaticMarkup(
      createElement(ServerCard, { server: editorial, locale: "ru" }),
    );
    expect(html).toContain("Unknown");
    expect(html).not.toContain("22 / 32");
    expect(russian).toContain("Неизвестно");
  });

  it("shows fresh official counts and drops them when the snapshot is stale", () => {
    const fresh = renderToStaticMarkup(
      createElement(ServerCard, { server: editorial, observation: observed, locale: "en" }),
    );
    const stale = renderToStaticMarkup(
      createElement(ServerCard, {
        server: editorial,
        observation: observed,
        isStale: true,
        locale: "en",
      }),
    );
    expect(fresh).toContain("Online");
    expect(fresh).toContain("7 / 32");
    expect(stale).toContain("Unknown");
    expect(stale).not.toContain("7 / 32");
  });

  it("keeps measured zero distinct from unknown player counts", () => {
    const zero = renderToStaticMarkup(
      createElement(ServerCard, { server: editorial, observation: observedZero, locale: "en" }),
    );
    const unknown = renderToStaticMarkup(
      createElement(ServerCard, {
        server: editorial,
        observation: observedUnknownPlayers,
        locale: "en",
      }),
    );
    expect(zero).toContain("0 / 32");
    expect(zero).not.toContain("Unknown");
    expect(unknown).toContain("Unknown");
    expect(unknown).not.toContain("0 / 32");
  });

  it("separates profile view from connect so the name does not launch the client", () => {
    const html = renderToStaticMarkup(
      createElement(ServerCard, { server: editorial, observation: observed, locale: "en" }),
    );
    expect(html).toContain('href="/servers/example"');
    expect(html).toContain('href="mtasa://203.0.113.5:22003"');
    expect(html).toContain("Open in MTA");
    expect(html).toContain("Copy address");
    expect(html).not.toMatch(/<a[^>]*href="mtasa:\/\/203\.0\.113\.5:22003"[^>]*>Example server/u);
  });
});

describe("home network server card honest states", () => {
  it("renders null players as unknown and zero as zero", () => {
    const unknown = renderToStaticMarkup(
      createElement(HomeNetworkServerCard, {
        observation: { address: "198.51.100.2", port: 22003, name: "Alpha" },
        locale: "en",
      }),
    );
    const zero = renderToStaticMarkup(
      createElement(HomeNetworkServerCard, {
        observation: {
          address: "198.51.100.3",
          port: 22003,
          name: "Beta",
          players: 0,
          maxPlayers: 64,
        },
        locale: "en",
      }),
    );
    const positive = renderToStaticMarkup(
      createElement(HomeNetworkServerCard, {
        observation: {
          address: "198.51.100.4",
          port: 22003,
          name: "Gamma",
          players: 12,
          maxPlayers: 64,
        },
        locale: "en",
      }),
    );

    expect(unknown).toContain("Player count unknown");
    expect(unknown).not.toContain("0 /");
    expect(zero).toContain("0 / 64");
    expect(zero).not.toContain("Player count unknown");
    expect(positive).toContain("12 / 64");
  });

  it("offers a NEXUS profile link only when a matched slug is provided", () => {
    const mapped = renderToStaticMarkup(
      createElement(HomeNetworkServerCard, {
        observation: { address: "198.51.100.5", port: 22003, name: "Mapped", players: 3 },
        profileSlug: "mapped-server",
        locale: "en",
      }),
    );
    const unmapped = renderToStaticMarkup(
      createElement(HomeNetworkServerCard, {
        observation: { address: "198.51.100.6", port: 22003, name: "Unmapped", players: 3 },
        locale: "en",
      }),
    );

    expect(mapped).toContain('href="/servers/mapped-server"');
    expect(unmapped).not.toContain("/servers/");
    expect(unmapped).toContain('href="mtasa://198.51.100.6:22003"');
    expect(unmapped).not.toMatch(/href="mtasa:\/\/[^"]*"[^>]*>Unmapped/u);
  });
});
