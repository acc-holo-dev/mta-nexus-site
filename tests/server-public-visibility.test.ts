import { beforeAll, describe, expect, it } from "vitest";
import { serverRepository } from "@nexus/db";
import { serverService } from "../apps/web/src/lib/services/server-service";
import type { ServerStatus, ServerVisibility } from "@nexus/domain";

describe("public editorial server visibility", () => {
  const suffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const slugs = {
    public: `public-server-${suffix}`,
    unlisted: `unlisted-server-${suffix}`,
    private: `private-server-${suffix}`,
    inactive: `inactive-server-${suffix}`,
  };

  beforeAll(async () => {
    const createServer = (
      id: string,
      slug: string,
      visibility: ServerVisibility,
      status: ServerStatus
    ) =>
      serverRepository.create({
        id,
        name: slug,
        slug,
        ipAddress: `${slug}.example.test`,
        port: 22003,
        visibility,
        status,
        isVerified: false,
      });

    await Promise.all([
      createServer(`srv_vis_public_${suffix}`, slugs.public, "public", "active"),
      createServer(`srv_vis_unlisted_${suffix}`, slugs.unlisted, "unlisted", "active"),
      createServer(`srv_vis_private_${suffix}`, slugs.private, "private", "active"),
      createServer(`srv_vis_inactive_${suffix}`, slugs.inactive, "public", "inactive"),
    ]);
  });

  it("allows public and unlisted active profiles, but hides private and inactive ones", async () => {
    expect((await serverService.getServerBySlug(slugs.public))?.visibility).toBe("public");
    expect((await serverService.getServerBySlug(slugs.unlisted))?.visibility).toBe("unlisted");
    expect(await serverService.getServerBySlug(slugs.private)).toBeNull();
    expect(await serverService.getServerBySlug(slugs.inactive)).toBeNull();
  });
});
