import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("mutation confirmation contracts", () => {
  it("accepts notification preferences only from a confirmed canonical response", () => {
    const settings = read("apps/web/src/app/settings/page.tsx");
    const route = read(
      "apps/web/src/app/api/notifications/preferences/route.ts",
    );

    expect(settings).toContain("data.success !== true");
    expect(settings).toContain("isPreferences(data.preferences)");
    expect(settings).toContain("setPreferences(data.preferences)");
    expect(route).toContain("{ success: true, preferences }");
    expect(route).toContain('"Cache-Control": "private, no-store"');
    expect(route).toContain('Vary: "Cookie"');
  });

  it("requires moderation actions to confirm success before refreshing", () => {
    for (const path of [
      "apps/web/src/components/build-moderation-controls.tsx",
      "apps/web/src/components/content-moderation-controls.tsx",
      "apps/web/src/components/verification-moderation-controls.tsx",
    ]) {
      const source = read(path);
      expect(source).toContain("data?.success !== true");
      expect(source.indexOf("data?.success !== true")).toBeLessThan(
        source.indexOf("router.refresh()"),
      );
    }
  });

  it("requires server updates and comments to return the mutated entity", () => {
    const server = read(
      "apps/web/src/components/server-details-form.tsx",
    );
    const comment = read(
      "apps/web/src/components/content-comment-form.tsx",
    );

    expect(server).toContain(
      'typeof data?.server?.id !== "string"',
    );
    expect(server).toContain("data.server.id !== server.id");
    expect(server.indexOf("data.server.id !== server.id")).toBeLessThan(
      server.indexOf("router.refresh()"),
    );

    expect(comment).toContain(
      'typeof payload?.comment?.id !== "string"',
    );
    expect(comment.indexOf("payload?.comment?.id")).toBeLessThan(
      comment.indexOf('setText("")'),
    );
  });

  it("requires follow mutations to confirm success before changing local state", () => {
    const source = read(
      "apps/web/src/components/server-follow-button.tsx",
    );

    expect(source).toContain("confirmsFollowMutation(");
    expect(source.indexOf("confirmsFollowMutation(")).toBeLessThan(
      source.indexOf("setState(expectedFollowing"),
    );
  });

  it("binds server-control proof UI to the exact issued challenge", () => {
    const source = read(
      "apps/web/src/components/server-claim-control-panel.tsx",
    );

    expect(source).toContain(
      'typeof data?.challenge?.challengeId !== "string"',
    );
    expect(source).toContain(
      'typeof data.challenge.token !== "string"',
    );
    expect(source).toContain(
      'typeof data.challenge.expiresAt !== "string"',
    );
    expect(source).toContain(
      "data.challenge.server?.id !== serverId",
    );
    expect(source).toContain("data?.success !== true");
    expect(source).toContain(
      'typeof data?.verificationRequest?.id !== "string"',
    );
    expect(source).toContain(
      "data?.proof?.challengeId !== challenge.challengeId",
    );
    expect(
      source.indexOf("data?.proof?.challengeId"),
    ).toBeLessThan(source.indexOf('setState("verified")'));
  });
});
