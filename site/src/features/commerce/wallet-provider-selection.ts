import {
  PAYMENT_PROVIDER_CAPABILITIES,
  PAYMENT_PROVIDER_IDS,
  type PaymentProviderCapability,
  type PaymentProviderId,
} from "@nexus/domain";

export type WalletProviderCapabilityRow = {
  id: PaymentProviderId;
  capabilities: readonly PaymentProviderCapability[];
  liveConfigured: boolean;
};

export type ConfirmedWalletProviders = {
  providers: WalletProviderCapabilityRow[];
  withdrawEnabled: boolean;
};

const PROVIDER_IDS = new Set<string>(PAYMENT_PROVIDER_IDS);
const CAPABILITIES = new Set<string>(PAYMENT_PROVIDER_CAPABILITIES);

function isProviderId(value: unknown): value is PaymentProviderId {
  return typeof value === "string" && PROVIDER_IDS.has(value);
}

function isCapability(value: unknown): value is PaymentProviderCapability {
  return typeof value === "string" && CAPABILITIES.has(value);
}

/** Narrow untrusted GET /api/wallet/providers JSON before UI selection. */
export function confirmedWalletProviders(body: unknown): ConfirmedWalletProviders | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  if (typeof record.withdrawEnabled !== "boolean") return null;
  if (!Array.isArray(record.providers)) return null;
  const providers: WalletProviderCapabilityRow[] = [];
  for (const row of record.providers) {
    if (!row || typeof row !== "object") return null;
    const item = row as Record<string, unknown>;
    if (!isProviderId(item.id)) return null;
    if (typeof item.liveConfigured !== "boolean") return null;
    if (!Array.isArray(item.capabilities)) return null;
    const capabilities: PaymentProviderCapability[] = [];
    for (const capability of item.capabilities) {
      if (!isCapability(capability)) return null;
      capabilities.push(capability);
    }
    providers.push({
      id: item.id,
      capabilities,
      liveConfigured: item.liveConfigured,
    });
  }
  return { providers, withdrawEnabled: record.withdrawEnabled };
}

/**
 * Prefer a live-configured provider for the capability; stub remains usable
 * while live PSP adapters stay dark (liveConfigured false).
 */
export function pickWalletProviderForCapability(
  providers: readonly WalletProviderCapabilityRow[],
  capability: PaymentProviderCapability,
): PaymentProviderId | null {
  const candidates = providers.filter((row) => row.capabilities.includes(capability));
  const live = candidates.find((row) => row.liveConfigured);
  if (live) return live.id;
  const stub = candidates.find((row) => row.id === "stub");
  return stub?.id ?? null;
}
