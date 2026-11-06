import { beforeEach, vi } from "vitest";

/** Shared repository mocks for verification workspace service suites. */
export const verificationWorkspaceServiceMocks = {
  own: vi.fn(),
  update: vi.fn(),
  publicProfile: vi.fn(),
  profile: vi.fn(),
  history: vi.fn(),
  targets: vi.fn(),
  createRequest: vi.fn(),
  resolveRequest: vi.fn(),
  applications: vi.fn(),
  application: vi.fn(),
  amend: vi.fn(),
};

/** Factory for `vi.mock("@nexus/db", …)` from suite files under `tests/`. */
export function createVerificationWorkspaceServiceDbMock() {
  const m = verificationWorkspaceServiceMocks;
  return {
    developerProfileRepository: m,
    verificationRepository: m,
    verificationWorkspaceRepository: m,
  };
}

function resetVerificationWorkspaceServiceMocks() {
  vi.clearAllMocks();
}

/** Wire shared `beforeEach` cleanup for verification workspace service suites. */
export function installVerificationWorkspaceServiceHooks() {
  beforeEach(() => {
    resetVerificationWorkspaceServiceMocks();
  });
}
