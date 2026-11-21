"use client";

import type { PaymentProviderCapability, PaymentProviderId } from "@nexus/domain";
import { useEffect, useState } from "react";
import { privateApiRequest } from "../../../lib/http/private-api-request";
import {
  confirmedWalletProviders,
  pickWalletProviderForCapability,
} from "../wallet-provider-selection";

export type WalletProviderSelectionState =
  | { status: "loading" }
  | { status: "ready"; providerId: PaymentProviderId }
  | { status: "unavailable" };

/** Load GET /api/wallet/providers and pick a usable port for the capability. */
export function useWalletProviderSelection(
  actorId: string,
  capability: PaymentProviderCapability,
): WalletProviderSelectionState {
  const [state, setState] = useState<WalletProviderSelectionState>({ status: "loading" });

  useEffect(() => {
    if (!actorId) {
      setState({ status: "unavailable" });
      return;
    }
    let active = true;
    const controller = new AbortController();
    setState({ status: "loading" });
    fetch("/api/wallet/providers", {
      ...privateApiRequest({ method: "GET", signal: controller.signal }),
      headers: { "x-nexus-actor-id": actorId },
    })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!active) return;
        const confirmed = response.ok ? confirmedWalletProviders(body) : null;
        const providerId = confirmed
          ? pickWalletProviderForCapability(confirmed.providers, capability)
          : null;
        setState(providerId ? { status: "ready", providerId } : { status: "unavailable" });
      })
      .catch(() => {
        if (active) setState({ status: "unavailable" });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [actorId, capability]);

  return state;
}
