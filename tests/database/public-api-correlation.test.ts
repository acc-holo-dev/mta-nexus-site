import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  browserMutationHeaders,
  stubBrowserMutationOrigin,
} from "../helpers/browser-mutation-headers";

const contentState = vi.hoisted(() => ({
  article: {
    id: "cnt_article",
    slug: "article-one",
    title: "Article One",
  } as Record<string, unknown> | null,
  fail: false,
}));

const getArticleBySlug = vi.hoisted(() =>
  vi.fn(async () => {
    if (contentState.fail) throw new Error("content db offline");
    return contentState.article;
  }),
);
const getComments = vi.hoisted(() => vi.fn(async () => []));
const getDirectory = vi.hoisted(() =>
  vi.fn(async () => ({
    fetchedAt: "2026-10-08T00:00:00.000Z",
    servers: [{ players: 10 }, { players: 5 }],
  })),
);

vi.mock("../../site/src/lib/services/content-service", () => ({
  contentService: {
    getArticleBySlug,
    getComments,
  },
}));

vi.mock("../../site/src/lib/services/mta-master-directory-service", () => ({
  mtaMasterDirectoryService: {
    getDirectory,
  },
}));

import { POST as checkoutPOST } from "../../site/src/app/api/checkout/route";
import { GET as contentGET } from "../../site/src/app/api/content/[slug]/route";
import { GET as mtaGET } from "../../site/src/app/api/mta/servers/route";

describe("public and disabled API correlation boundaries", () => {
  beforeEach(() => {
    stubBrowserMutationOrigin();
    vi.clearAllMocks();
    contentState.article = {
      id: "cnt_article",
      slug: "article-one",
      title: "Article One",
    };
    contentState.fail = false;
  });

  it("does not cache article success", async () => {
    const response = await contentGET(
      new NextRequest("https://nexus.test/api/content/article-one"),
      {
        params: Promise.resolve({
          slug: "article-one",
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-request-id")).toBeNull();
  });

  it("correlates article validation and upstream failures without caching them", async () => {
    const invalid = await contentGET(new NextRequest("https://nexus.test/api/content/INVALID"), {
      params: Promise.resolve({
        slug: "INVALID",
      }),
    });
    expect(invalid.status).toBe(404);
    expect(invalid.headers.get("cache-control")).toBe("no-store");
    expect(invalid.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{20,}$/u);

    contentState.fail = true;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const failed = await contentGET(
        new NextRequest("https://nexus.test/api/content/article-one"),
        {
          params: Promise.resolve({
            slug: "article-one",
          }),
        },
      );
      expect(failed.status).toBe(503);
      expect(failed.headers.get("cache-control")).toBe("no-store");
      expect(failed.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{20,}$/u);
      expect(JSON.stringify(await failed.json())).not.toContain("content db offline");
    } finally {
      log.mockRestore();
    }
  });

  it("returns correlated no-store free-beta checkout failures", async () => {
    const response = await checkoutPOST(
      new NextRequest("https://nexus.test/api/checkout", {
        method: "POST",
        headers: browserMutationHeaders(),
      }),
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{20,}$/u);
    await expect(response.json()).resolves.toMatchObject({
      code: "CHECKOUT_DISABLED",
    });
  });

  it("correlates the dynamic legacy MTA snapshot and sums players", async () => {
    const response = await mtaGET(new NextRequest("https://nexus.test/api/mta/servers"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{20,}$/u);
    await expect(response.json()).resolves.toMatchObject({
      source: "mta-master",
      playersOnline: 15,
    });
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});
