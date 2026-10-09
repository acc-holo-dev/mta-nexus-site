import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: null as null | {
    id: string;
    username: string;
    role: string;
  },
}));

const mocks = vi.hoisted(() => ({
  follows: vi.fn(),
  products: vi.fn(),
  servers: vi.fn(),
  directory: vi.fn(),
  indexObservations: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      name === "nexus_session" && state.user
        ? { value: "session-token" }
        : undefined,
  })),
}));

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({
      href,
      children,
      ...props
    }: {
      href: string;
      children: ReactNode;
      [key: string]: unknown;
    }) => React.createElement("a", { href, ...props }, children),
  };
});

vi.mock("@nexus/db", () => ({
  socialRepository: {
    listFollows: mocks.follows,
  },
  productRepository: {
    listPublishedFreeByIds: mocks.products,
  },
  serverRepository: {
    listActivePublicByIds: mocks.servers,
  },
}));

vi.mock("@nexus/ui", async () => {
  const React = await import("react");
  return {
    EmptyState: ({
      title,
      description,
      action,
    }: {
      title: string;
      description: string;
      action?: ReactNode;
    }) =>
      React.createElement(
        "div",
        { "data-testid": "empty-state" },
        title,
        description,
        action,
      ),
  };
});

vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: {
    getSession: vi.fn(async () => state.user),
  },
}));

vi.mock(
  "../apps/web/src/lib/services/mta-master-directory-service",
  () => ({
    mtaMasterDirectoryService: {
      getDirectory: mocks.directory,
    },
    indexMtaObservations: mocks.indexObservations,
  }),
);

vi.mock("../apps/web/src/lib/i18n-server", () => ({
  getRequestLocale: vi.fn(async () => "en"),
}));

vi.mock("../apps/web/src/components/product-card", async () => {
  const React = await import("react");
  return {
    ProductCard: ({
      product,
    }: {
      product: { id: string };
    }) =>
      React.createElement("div", {
        "data-testid": "saved-product",
        "data-id": product.id,
      }),
  };
});

vi.mock("../apps/web/src/components/server-card", async () => {
  const React = await import("react");
  return {
    ServerCard: ({
      server,
      observation,
    }: {
      server: { id: string };
      observation: unknown;
    }) =>
      React.createElement("div", {
        "data-testid": "saved-server",
        "data-id": server.id,
        "data-observed": observation ? "true" : "false",
      }),
  };
});

import SavedPage from "../apps/web/src/app/workspace/saved/page";

describe("saved follows page behavior", () => {
  afterEach(() => vi.useRealTimers());

  beforeEach(() => {
    vi.clearAllMocks();
    state.user = null;
    mocks.follows.mockResolvedValue([]);
    mocks.products.mockResolvedValue([]);
    mocks.servers.mockResolvedValue([]);
    mocks.directory.mockResolvedValue({
      servers: [],
      isStale: false,
    });
    mocks.indexObservations.mockReturnValue(() => null);
  });

  it("renders a sign-in boundary without reading saved follows", async () => {
    const html = renderToStaticMarkup(await SavedPage());

    expect(html).toContain('href="/auth/login"');
    expect(mocks.follows).not.toHaveBeenCalled();
    expect(mocks.products).not.toHaveBeenCalled();
    expect(mocks.servers).not.toHaveBeenCalled();
    expect(mocks.directory).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "starts MTA loading when servers resolve while resources are pending (upstream failure: %s)",
    async (upstreamFailure) => {
      vi.useFakeTimers();
      const startedAt = Date.now();
      state.user = { id: "usr_saved", username: "saved", role: "user" };
      mocks.follows.mockResolvedValue([
        { targetType: "server", targetId: "srv_saved" },
        { targetType: "product", targetId: "prd_saved" },
      ]);
      mocks.products.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return [{ id: "prd_saved" }];
      });
      mocks.servers.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return [{ id: "srv_saved" }];
      });
      mocks.directory.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 250));
        if (upstreamFailure) throw new Error("MTA unavailable");
        return { servers: [{ players: 12 }], isStale: false };
      });
      const rendering = SavedPage();
      try {
        await vi.advanceTimersByTimeAsync(0);
        expect(mocks.products).toHaveBeenCalledOnce();
        expect(mocks.servers).toHaveBeenCalledOnce();
        expect(mocks.directory).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(100);
        expect(mocks.directory).toHaveBeenCalledOnce();
        await vi.runAllTimersAsync();
        const html = renderToStaticMarkup(await rendering);
        expect(Date.now() - startedAt).toBe(500);
        expect(html).toContain('data-id="prd_saved"');
        expect(html).toContain('data-id="srv_saved"');
        expect(mocks.indexObservations).toHaveBeenCalledWith(
          upstreamFailure ? [] : [{ players: 12 }],
        );
      } finally {
        await vi.runAllTimersAsync();
        await rendering;
      }
    },
  );

  it("loads saved public resources and servers from the authenticated follow set", async () => {
    state.user = {
      id: "usr_saved",
      username: "saved",
      role: "user",
    };
    mocks.follows.mockResolvedValue([
      {
        id: "fol_1",
        followerId: "usr_saved",
        targetType: "server",
        targetId: "srv_b",
      },
      {
        id: "fol_2",
        followerId: "usr_saved",
        targetType: "product",
        targetId: "prd_a",
      },
      {
        id: "fol_3",
        followerId: "usr_saved",
        targetType: "server",
        targetId: "srv_a",
      },
      {
        id: "fol_4",
        followerId: "usr_saved",
        targetType: "user",
        targetId: "usr_other",
      },
    ]);
    mocks.products.mockResolvedValue([
      { id: "prd_a", slug: "resource-a", title: "Resource A" },
    ]);
    mocks.servers.mockResolvedValue([
      { id: "srv_a", slug: "server-a", name: "Server A" },
      { id: "srv_b", slug: "server-b", name: "Server B" },
    ]);
    mocks.directory.mockResolvedValue({
      servers: [{ address: "203.0.113.10", port: 22003 }],
      isStale: false,
    });
    mocks.indexObservations.mockReturnValue((server: { id: string }) =>
      server.id === "srv_b" ? { players: 12 } : null,
    );

    const html = renderToStaticMarkup(await SavedPage());

    expect(mocks.follows).toHaveBeenCalledWith("usr_saved");
    expect(mocks.products).toHaveBeenCalledWith(["prd_a"]);
    expect(mocks.servers).toHaveBeenCalledWith(["srv_b", "srv_a"]);
    expect(mocks.directory).toHaveBeenCalledOnce();
    expect(html).toContain('data-testid="saved-product"');
    expect(html).toContain('data-id="prd_a"');
    expect(html).toContain('data-id="srv_b"');
    expect(html).toContain('data-id="srv_a"');
  });

  it("does not call the MTA directory when no saved public server survives filtering", async () => {
    state.user = {
      id: "usr_saved",
      username: "saved",
      role: "user",
    };
    mocks.follows.mockResolvedValue([
      {
        id: "fol_1",
        followerId: "usr_saved",
        targetType: "server",
        targetId: "srv_private_or_missing",
      },
    ]);
    mocks.servers.mockResolvedValue([]);

    const html = renderToStaticMarkup(await SavedPage());

    expect(mocks.servers).toHaveBeenCalledWith([
      "srv_private_or_missing",
    ]);
    expect(mocks.directory).not.toHaveBeenCalled();
    expect(html).toContain('href="/servers"');
  });
});
