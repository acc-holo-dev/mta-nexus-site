import type { ReactNode } from "react";
import { vi } from "vitest";

vi.mock("../../src/lib/services/resource-management-service", () => ({
  resourceManagementService: { publicVariants: vi.fn(async () => null) },
}));

vi.mock("next/headers", async () => {
  const { state } = await import("./resource-detail-acquisition-ui-state");
  return {
    cookies: vi.fn(async () => ({
      get: (name: string) =>
        name === "nexus_session" && state.user ? { value: "session-token" } : undefined,
    })),
  };
});

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/link", async () => {
  const ReactModule = await import("react");
  return {
    default: ({
      href,
      children,
      ...props
    }: {
      href: string;
      children: ReactNode;
      [key: string]: unknown;
    }) => ReactModule.createElement("a", { href, ...props }, children),
  };
});

vi.mock("../../src/lib/i18n-server", async () => {
  const { state } = await import("./resource-detail-acquisition-ui-state");
  return {
    getRequestLocale: vi.fn(async () => state.locale),
  };
});

vi.mock("../../src/lib/services/auth-service", async () => {
  const { state } = await import("./resource-detail-acquisition-ui-state");
  return {
    authService: {
      getSession: vi.fn(async () => state.user),
    },
  };
});

vi.mock("../../src/lib/services/commerce-service", async () => {
  const { state } = await import("./resource-detail-acquisition-ui-state");
  return {
    commerceService: {
      checkEntitlement: vi.fn(async () => state.entitled),
    },
  };
});

vi.mock("../../src/lib/services/resource-review-service", () => ({
  resourceReviewService: {
    publicPage: vi.fn(async () => ({ reviews: [], total: 0, page: 1, totalPages: 1 })),
  },
}));

vi.mock("../../src/lib/services/product-service", async () => {
  const { productService } = await import("./resource-detail-acquisition-ui-state");
  return { productService };
});

vi.mock("../../src/lib/services/resource-qa-service", () => ({
  resourceQaService: {
    publicPage: vi.fn(async () => ({
      threads: [],
      total: 0,
      page: 1,
      totalPages: 1,
      capabilities: { canAsk: false, askReason: "guest" },
    })),
  },
}));

vi.mock("../../src/features/resources/components/resource-qa-panel", async () => {
  const ReactModule = await import("react");
  return {
    ResourceQaPanel: () => ReactModule.createElement("div", { "data-testid": "resource-qa" }),
  };
});

vi.mock("../../src/features/resources/components/resource-preview", async () => {
  const ReactModule = await import("react");
  return {
    ResourcePreview: ({ title }: { title: string }) =>
      ReactModule.createElement("div", {
        "data-testid": "resource-preview",
        "data-title": title,
      }),
  };
});

vi.mock("../../src/components/resource-download-button", async () => {
  const ReactModule = await import("react");
  return {
    ResourceDownloadButton: ({
      productId,
      version,
      intent,
    }: {
      productId: string;
      version: string;
      intent?: string;
    }) =>
      ReactModule.createElement("button", {
        "data-testid": "resource-download",
        "data-product-id": productId,
        "data-version": version,
        "data-download-intent": intent ?? "latest",
      }),
  };
});

vi.mock("../../src/components/resource-release-watch-control", async () => {
  const ReactModule = await import("react");
  return {
    ResourceReleaseWatchControl: ({ guest, hasAccess }: { guest?: boolean; hasAccess?: boolean }) =>
      ReactModule.createElement("div", {
        "data-testid": "resource-release-watch",
        "data-guest": guest ? "true" : "false",
        "data-has-access": hasAccess === false ? "false" : "true",
      }),
  };
});

vi.mock("../../src/lib/services/resource-release-watches-service", () => ({
  resourceReleaseWatchesService: {
    detail: vi.fn(async () => ({
      productId: "prd_detail",
      enabled: false,
      revision: 0,
      updatedAt: null,
    })),
  },
}));

vi.mock("@nexus/db", () => ({
  resourceMediaRepository: { publicItems: async () => [], managed: async () => ({ items: [] }) },
  notificationRepository: {
    getPreferences: vi.fn(async () => ({
      followsEnabled: true,
      contentEnabled: true,
      serverEnabled: true,
      commerceEnabled: true,
      systemEnabled: true,
    })),
  },
  followWorkspaceRepository: {
    states: vi.fn(async () => [] as string[]),
    muteState: vi.fn(async () => ({ muted: false, mutedUntil: null })),
  },
}));

vi.mock("../../src/components/follow-button", async () => {
  const ReactModule = await import("react");
  return {
    FollowButton: ({ targetType, targetId }: { targetType: string; targetId: string }) =>
      ReactModule.createElement("button", {
        type: "button",
        "data-testid": "resource-save",
        "data-target-type": targetType,
        "data-target-id": targetId,
      }),
  };
});

vi.mock("../../src/features/resources/components/build-provenance-details", async () => {
  const ReactModule = await import("react");
  return {
    BuildProvenanceDetails: ({ build }: { build: { id: string } }) =>
      ReactModule.createElement("div", {
        "data-testid": "build-provenance",
        "data-build-id": build.id,
      }),
  };
});

vi.mock("../../src/components/product-dependency-list", async () => {
  const ReactModule = await import("react");
  return {
    ProductDependencyList: () =>
      ReactModule.createElement("span", {
        "data-testid": "product-dependencies",
      }),
  };
});

vi.mock("../../src/components/reverse-dependency-list", async () => {
  const ReactModule = await import("react");
  return {
    ReverseDependencyList: () =>
      ReactModule.createElement("span", {
        "data-testid": "reverse-dependencies",
      }),
  };
});
