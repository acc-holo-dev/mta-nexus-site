import {
  AppError,
  assertProductionStubSignatureRejected,
  RateLimitExceededError,
  UnauthorizedError,
  type User,
} from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import type { NextRequest } from "next/server";
import { requireServerJsonContentType } from "../../lib/http/bounded-json";
import { resolveLocale } from "../../lib/i18n";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
} from "../../lib/platform/observability";
import { authService } from "../../lib/services/accounts/auth-service";
import {
  isWalletEngineEnabled,
  WalletPaymentService,
} from "../../lib/services/commerce/wallet-payment-service";
import { getTrustedRequestIp } from "../shell/request-client-ip";
import { walletError } from "./wallet-i18n";

/** Shared service instance for wallet HTTP routes (stub ports only). */
export const walletPaymentService = new WalletPaymentService();

function requireWalletEngineEnabled(): void {
  if (!isWalletEngineEnabled()) {
    throw new AppError("Wallet engine is disabled", 404, "WALLET_ENGINE_DISABLED");
  }
}

export function requestHeaderRecord(request: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return headers;
}

export async function walletSessionRequest(
  request: NextRequest,
  mutation: boolean,
  operation: (actor: User) => Promise<unknown>,
) {
  const context = createRequestLogContext(request);
  const locale = resolveLocale(request.cookies.get("nexus_locale")?.value);
  const respond = (body: unknown, status = 200) =>
    jsonWithRequestId(context, body, {
      status,
      headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
    });
  const codeBody = (code: string) => ({ code, error: walletError(locale, code) });
  try {
    requireWalletEngineEnabled();
    const actor = await authService.getSession(request.cookies.get("nexus_session")?.value);
    if (!actor) throw new UnauthorizedError();
    if (mutation) {
      requireServerJsonContentType(request);
      if (request.headers.get("sec-fetch-site") === "cross-site") {
        throw new AppError("Cross-site mutation is forbidden", 403, "FORBIDDEN");
      }
      if (!(await consumeRateLimit("contentCreation", actor.id)).success) {
        throw new RateLimitExceededError();
      }
    } else if (!(await consumeRateLimit("resourceInspection", actor.id)).success) {
      throw new RateLimitExceededError();
    }
    return respond(await operation(actor));
  } catch (error) {
    if (error instanceof AppError) return respond(codeBody(error.code), error.statusCode);
    logRequestEvent({
      level: "error",
      event: "wallet.session_failed",
      context,
      status: 500,
      error,
    });
    return respond(codeBody("WALLET_SESSION_FAILED"), 500);
  }
}

export async function walletWebhookRequest(
  request: NextRequest,
  operation: () => Promise<unknown>,
) {
  const context = createRequestLogContext(request);
  const locale = resolveLocale(request.cookies.get("nexus_locale")?.value);
  const respond = (body: unknown, status = 200) =>
    jsonWithRequestId(context, body, {
      status,
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  const codeBody = (code: string) => ({ code, error: walletError(locale, code) });
  try {
    assertProductionStubSignatureRejected(request.headers.get("x-nexus-stub-signature"));
    requireWalletEngineEnabled();
    requireServerJsonContentType(request);
    if (!(await consumeRateLimit("resourceInspection", getTrustedRequestIp(request))).success) {
      throw new RateLimitExceededError();
    }
    return respond(await operation());
  } catch (error) {
    if (error instanceof AppError) return respond(codeBody(error.code), error.statusCode);
    logRequestEvent({
      level: "error",
      event: "wallet.webhook_failed",
      context,
      status: 500,
      error,
    });
    return respond(codeBody("WALLET_WEBHOOK_FAILED"), 500);
  }
}
