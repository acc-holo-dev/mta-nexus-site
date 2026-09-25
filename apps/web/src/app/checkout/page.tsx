"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Lock, ShieldCheck } from "lucide-react";
import { getDictionary, resolveLocale, type Locale } from "../../lib/i18n";

interface ProductInfo {
  id: string;
  slug: string;
  title: string;
  price: number;
  currency: string;
  licenseModel: string;
  currentVersion: string;
}

function readBrowserLocale(): Locale {
  if (typeof document === "undefined") return "en";
  const match = document.cookie.match(/(?:^|; )nexus_locale=([^;]+)/);
  return resolveLocale(match?.[1]);
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  const productId = searchParams.get("productId");
  const [locale, setLocale] = useState<Locale>("en");
  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [productError, setProductError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocale(readBrowserLocale());
  }, []);

  const copy = getDictionary(locale).checkout;

  useEffect(() => {
    if (!productId) return;
    const controller = new AbortController();

    setProduct(null);
    setProductError(null);
    fetch(`/api/products/${encodeURIComponent(productId)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(copy.productNotFound);
        return (await response.json()) as ProductInfo;
      })
      .then(setProduct)
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setProductError(
          caught instanceof Error ? caught.message : copy.productNotFound,
        );
      });

    return () => controller.abort();
  }, [productId, copy.productNotFound]);

  async function handleClaim() {
    if (!product || product.price > 0 || loading) {
      if (product?.price && product.price > 0) {
        setError(copy.paidNotAvailable);
      }
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/resources/claim", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id }),
        signal: AbortSignal.timeout(15_000),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || copy.claimFailed);
      }

      setCompleted(true);
    } catch (caught: unknown) {
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : copy.unexpected,
      );
    } finally {
      setLoading(false);
    }
  }

  if (completed) {
    return (
      <div className="mx-auto max-w-xl space-y-6 py-12">
        <div className="space-y-4 rounded-2xl border border-emerald-500/30 bg-surface p-8 text-center shadow-2xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h1 className="text-2xl font-black text-white">
            {copy.resourceAdded}
          </h1>
          <p className="text-xs text-neutral-400">
            {copy.resourceAddedMessage}
          </p>

          <div className="flex flex-col justify-center gap-3 pt-6 sm:flex-row">
            <Link
              href={`/market/${product?.slug ?? ""}`}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
            >
              {copy.openResource}
            </Link>
            <Link
              href="/workspace"
              className="rounded-lg border border-base bg-neutral-900 px-5 py-2.5 text-xs font-semibold text-neutral-300 transition-colors hover:bg-neutral-800"
            >
              {copy.openLibrary}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!productId || productError) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-16 text-center">
        <h1 className="text-xl font-black text-white">
          {productError || copy.noProduct}
        </h1>
        <p className="text-xs text-neutral-400">{copy.chooseResource}</p>
        <Link
          href="/market"
          className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
        >
          {copy.browse}
        </Link>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center text-xs text-neutral-400">
        {copy.loadingProduct}
      </div>
    );
  }

  const formattedPrice =
    product.price === 0
      ? copy.free
      : new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", {
          style: "currency",
          currency: product.currency || "USD",
        }).format(product.price / 100);

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-8">
      <div className="border-b border-base pb-4">
        <h1 className="flex items-center gap-2 text-2xl font-black text-white">
          <Lock className="h-5 w-5 text-blue-500" />
          <span>{copy.title}</span>
        </h1>
        <p className="mt-1 text-xs text-neutral-400">{copy.description}</p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-900 bg-red-950/30 p-4 text-xs text-red-400"
        >
          {error}
        </div>
      )}

      <div className="space-y-4 rounded-xl border border-base bg-surface p-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-white">
          {copy.orderSummary}
        </h2>
        <div className="flex items-center justify-between border-b border-neutral-800 py-2 text-sm">
          <span className="text-neutral-200">{product.title}</span>
          <span className="font-mono font-bold text-white">
            {formattedPrice}
          </span>
        </div>
        <div className="flex items-center justify-between py-1 text-xs text-neutral-400">
          <span className="capitalize">
            {copy.licenseModel}: {product.licenseModel.replace(/_/g, " ")}
          </span>
          <span className="font-mono">v{product.currentVersion}</span>
        </div>
        <div className="flex items-center justify-between pt-2 text-base font-black text-white">
          <span>{copy.totalDue}</span>
          <span className="font-mono text-emerald-400">
            {formattedPrice}
          </span>
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-base bg-surface p-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-white">
          {product.price === 0 ? copy.freeResource : copy.paidCheckout}
        </h2>
        <p className="text-xs text-neutral-400">
          {product.price === 0 ? copy.noPaymentRequired : copy.paidDisabled}
        </p>
      </div>

      <button
        type="button"
        onClick={() => void handleClaim()}
        disabled={loading || product.price > 0}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-600 py-3.5 text-sm font-bold text-white shadow-xl shadow-blue-500/20 transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading
          ? copy.adding
          : product.price === 0
            ? copy.addToLibrary
            : copy.paidUnavailable}
      </button>

      <div className="flex items-center justify-center gap-2 text-xs text-neutral-500">
        <ShieldCheck className="h-4 w-4 text-emerald-500" />
        <span>{copy.noSimulatedPayments}</span>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <React.Suspense
      fallback={
        <div className="mx-auto max-w-2xl py-12 text-center text-xs text-neutral-400">
          Loading checkout session...
        </div>
      }
    >
      <CheckoutContent />
    </React.Suspense>
  );
}
