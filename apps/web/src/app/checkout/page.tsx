"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  Lock,
  ArrowRight,
  Key,
  Server,
} from "lucide-react";

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const productId = searchParams.get("productId") || "prd_inv_pro";

  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePay = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productIds: [productId],
          paymentProvider: "mock",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Payment failed");
      }

      setCompleted(data);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during checkout");
    } finally {
      setLoading(false);
    }
  };

  if (completed) {
    return (
      <div className="max-w-xl mx-auto py-12 space-y-6">
        <div className="p-8 rounded-2xl border border-emerald-500/30 bg-[#11131a] text-center space-y-4 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-black text-white">Payment Completed!</h1>
          <p className="text-xs text-neutral-400">
            Order #{completed.order?.orderNumber} has been verified and settled in the immutable ledger.
          </p>

          {/* Provisioned License */}
          {completed.licenses && completed.licenses.length > 0 && (
            <div className="p-4 rounded-xl bg-neutral-900 border border-[#232838] text-left space-y-2 mt-6">
              <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
                <Key className="w-4 h-4 text-blue-400" />
                <span>Your Cryptographic License Key</span>
              </div>
              <div className="font-mono text-sm text-emerald-400 select-all p-3 rounded bg-black/60 border border-neutral-800">
                {completed.licenses[0].key}
              </div>
              <p className="text-[11px] text-neutral-500">
                Insert this key into your server&apos;s <code className="text-neutral-300">nexus.json</code> or module config to activate.
              </p>
            </div>
          )}

          <div className="pt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/workspace"
              className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors"
            >
              Go to My Workspace
            </Link>
            <Link
              href="/market"
              className="px-5 py-2.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-[#232838] font-semibold text-xs transition-colors"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-8">
      <div className="border-b border-[#232838] pb-4">
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <Lock className="w-5 h-5 text-blue-500" />
          <span>Secure Checkout</span>
        </h1>
        <p className="text-xs text-neutral-400 mt-1">
          Instant cryptographic license provisioning with Escrow protection.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-950/30 border border-red-900 text-red-400 text-xs">
          {error}
        </div>
      )}

      {/* Order Summary */}
      <div className="p-6 rounded-xl border border-[#232838] bg-[#11131a] space-y-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">Order Summary</h2>
        <div className="flex items-center justify-between py-2 border-b border-neutral-800 text-sm">
          <span className="text-neutral-200">Selected Resource Product</span>
          <span className="font-bold font-mono text-white">$34.99</span>
        </div>
        <div className="flex items-center justify-between py-1 text-xs text-neutral-400">
          <span>Platform Processing Fee (Included)</span>
          <span className="font-mono">$2.45</span>
        </div>
        <div className="flex items-center justify-between pt-2 text-base font-black text-white">
          <span>Total Due</span>
          <span className="font-mono text-emerald-400">$34.99</span>
        </div>
      </div>

      {/* Payment Selector */}
      <div className="p-6 rounded-xl border border-[#232838] bg-[#11131a] space-y-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">Payment Method</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-lg border-2 border-blue-500 bg-blue-950/20 text-white cursor-pointer space-y-1">
            <div className="font-bold text-xs flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-blue-400" />
              <span>Instant Sandbox / Card</span>
            </div>
            <div className="text-[11px] text-neutral-400">Direct simulated checkout</div>
          </div>
          <div className="p-4 rounded-lg border border-neutral-800 bg-neutral-900/50 text-neutral-400 space-y-1 opacity-70">
            <div className="font-bold text-xs">Crypto (USDT / TON)</div>
            <div className="text-[11px] text-neutral-500">Available on mainnet</div>
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <button
        onClick={handlePay}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-xl shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
      >
        {loading ? (
          <span>Authorizing & Recording Ledger...</span>
        ) : (
          <>
            <span>Authorize & Pay $34.99</span>
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>

      <div className="flex items-center justify-center gap-2 text-xs text-neutral-500">
        <ShieldCheck className="w-4 h-4 text-emerald-500" />
        <span>256-Bit SSL Encrypted & Double-Entry Ledger Protection</span>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <React.Suspense
      fallback={
        <div className="max-w-2xl mx-auto py-12 text-center text-xs text-neutral-400">
          Loading checkout session...
        </div>
      }
    >
      <CheckoutContent />
    </React.Suspense>
  );
}
