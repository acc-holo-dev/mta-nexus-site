import type { ReactNode } from "react";
import { beforeEach, vi } from "vitest";

/** Shared session actor for workspace live-source suites. */
export const workspaceLiveSourceState = {
  user: {
    id: "usr_workspace",
    username: "workspace-user",
    role: "user",
  } as null | { id: string; username: string; role: string },
};

/** Shared repository mocks for workspace live-source suites. */
export const workspaceLiveSourceRepos = {
  library: vi.fn(),
  managedServers: vi.fn(),
  directory: vi.fn(),
};

/** Factory for `vi.mock("next/headers", …)` from suite files under `tests/`. */
export function createWorkspaceLiveSourceHeadersMock() {
  return {
    cookies: vi.fn(async () => ({
      get: (name: string) =>
        name === "nexus_session" && workspaceLiveSourceState.user
          ? { value: "session-token" }
          : undefined,
    })),
  };
}

/** Factory for `vi.mock("next/navigation", …)` from suite files under `tests/`. */
export function createWorkspaceLiveSourceNavigationMock() {
  return { usePathname: () => "/workspace" };
}

/** Factory for `vi.mock("next/link", …)` from suite files under `tests/`. */
export async function createWorkspaceLiveSourceLinkMock() {
  const React = await import("react");
  return {
    default: ({
      href,
      children,
      className,
    }: {
      href: string;
      children: ReactNode;
      className?: string;
    }) => React.createElement("a", { href, className }, children),
  };
}

/** Factory for `vi.mock("@nexus/db", …)` from suite files under `tests/`. */
export function createWorkspaceLiveSourceDbMock() {
  return {
    userLibraryRepository: { pageByUser: workspaceLiveSourceRepos.library },
    serverRepository: { pageManagedByUser: workspaceLiveSourceRepos.managedServers },
  };
}

/** Factory for auth-service mock from suite files under `tests/`. */
export function createWorkspaceLiveSourceAuthMock() {
  return {
    authService: {
      getSession: vi.fn(async () => workspaceLiveSourceState.user),
    },
  };
}

/** Factory for i18n-server mock from suite files under `tests/`. */
export function createWorkspaceLiveSourceI18nMock() {
  return {
    getRequestLocale: vi.fn(async () => "en"),
  };
}

/** Factory for mta-master-directory-service mock from suite files under `tests/`. */
export function createWorkspaceLiveSourceDirectoryMock() {
  return {
    mtaMasterDirectoryService: {
      getDirectory: workspaceLiveSourceRepos.directory,
    },
    indexMtaObservations: vi.fn(
      (observations: Array<Record<string, unknown>>) => (server: { id: string }) =>
        observations.find((observation) => observation.serverId === server.id) ?? null,
    ),
    mtaLiveStatus: vi.fn((observation: null | { liveStatus?: string }, stale: boolean) =>
      stale ? "unknown" : (observation?.liveStatus ?? "unknown"),
    ),
  };
}

function resetWorkspaceLiveSourceState() {
  vi.clearAllMocks();
  workspaceLiveSourceState.user = {
    id: "usr_workspace",
    username: "workspace-user",
    role: "user",
  };
  workspaceLiveSourceRepos.library.mockResolvedValue({
    items: [],
    counts: { all: 0, ready: 0, unavailable: 0 },
    page: 1,
    pageSize: 4,
    total: 0,
    totalPages: 1,
  });
  workspaceLiveSourceRepos.managedServers.mockResolvedValue({
    servers: [],
    total: 0,
    page: 1,
    pageSize: 4,
    totalPages: 1,
  });
  workspaceLiveSourceRepos.directory.mockResolvedValue({
    servers: [],
    isStale: false,
  });
}

export function installWorkspaceLiveSourceHooks() {
  beforeEach(() => {
    resetWorkspaceLiveSourceState();
  });
}
