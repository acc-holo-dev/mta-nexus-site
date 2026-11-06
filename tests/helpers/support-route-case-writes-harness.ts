import { vi } from "vitest";
import {
  createSupportRouteDbMock,
  createSupportRouteSecurityMock,
  expectSupportPrivate,
  installSupportRouteLifecycle,
  supportCaseId,
  supportMutationHeaders,
  supportRouteAfterMock,
  supportRouteMocks,
  supportRouteParams,
  supportRouteState,
} from "./support-route-harness";

export {
  expectSupportPrivate,
  supportCaseId,
  supportMutationHeaders,
  supportRouteAfterMock,
  supportRouteMocks,
  supportRouteParams,
  supportRouteState,
};

/** Factory for `vi.mock("next/server", …)` — use only inside `vi.mock` callbacks. */
export async function createSupportRouteCaseWritesNextServerMock() {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual, after: supportRouteAfterMock };
}

/** Factory for `vi.mock("../apps/web/src/lib/services/auth-service", …)`. */
export function createSupportRouteCaseWritesAuthServiceMock() {
  return { authService: { getSession: supportRouteMocks.session } };
}

/** Factory for `vi.mock("@nexus/security", …)`. */
export function createSupportRouteCaseWritesSecurityMock() {
  return createSupportRouteSecurityMock();
}

/** Factory for `vi.mock("@nexus/db", …)`. */
export function createSupportRouteCaseWritesDbMock() {
  return createSupportRouteDbMock();
}

/** Factory for `vi.mock("../apps/web/src/lib/services/notification-dispatch-service", …)`. */
export function createSupportRouteCaseWritesNotificationDispatchMock() {
  return { dispatchNotificationsBestEffort: supportRouteMocks.dispatch };
}

/** beforeEach/afterEach hooks shared by support case-write HTTP suites. */
export function installSupportRouteCaseWritesHooks() {
  installSupportRouteLifecycle();
}
