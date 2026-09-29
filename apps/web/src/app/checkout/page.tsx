"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  CheckCircle2,
  Lock,
} from "lucide-react";

interface ProductInfo {
  id: string;
  title: string;
  price: number;
  currency: string;
  licenseModel: string;
  currentVersion: string;
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  const productId = searchParams.get("productId");

  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [productError, setProductError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!productId) return;
    fetch(`/api/products/${productId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Product not found");
        return res.json();
      })
      .then(setProduct)
      .catch((e) => setProductError(e.message));
  }, [productId]);

  const handlePay = async () => {
    if (!product || product.price > 0) {
      setError("Paid checkout is not available yet.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/resources/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Could not add the resource");
      }

      setCompleted(data);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (completed) {
    return (
      <div className="max-w-xl mx-auto py-12 space-y-6">
        <div className="p-8 rounded-2xl border border-emerald-500/30 bg-surface text-center space-y-4 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-black text-white">Resource added</h1>
          <p className="text-xs text-neutral-400">
            This free resource is now available in your library.
          </p>

          <div className="pt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/workspace/licenses"
              className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors"
            >
              Go to My Licenses
            </Link>
            <Link
              href="/market"
              className="px-5 py-2.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-base font-semibold text-xs transition-colors"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!productId || productError) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <h1 className="text-xl font-black text-white">
          {productError || "No product selected"}
        </h1>
        <p className="text-xs text-neutral-400">
          Choose a resource in the marketplace to proceed to checkout.
        </p>
        <Link
          href="/market"
          className="inline-block px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors"
        >
          Browse Marketplace
        </Link>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center text-xs text-neutral-400">
        Loading product details...
      </div>
    );
  }

  const formattedPrice = product.price === 0 ? "Free" : `$${(product.price / 100).toFixed(2)}`;

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-8">
      <div className="border-b border-base pb-4">
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <Lock className="w-5 h-5 text-blue-500" />
          <span>Secure Checkout</span>
        </h1>
        <p className="text-xs text-neutral-400 mt-1">
          Free resources can be added instantly. Paid checkout will open after a real provider is connected.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-950/30 border border-red-900 text-red-400 text-xs">
          {error}
        </div>
      )}

      {/* Order Summary — real product data */}
      <div className="p-6 rounded-xl border border-base bg-surface space-y-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">Order Summary</h2>
        <div className="flex items-center justify-between py-2 border-b border-neutral-800 text-sm">
          <span className="text-neutral-200">{product.title}</span>
          <span className="font-bold font-mono text-white">{formattedPrice}</span>
        </div>
        <div className="flex items-center justify-between py-1 text-xs text-neutral-400">
          <span className="capitalize">License model: {product.licenseModel.replace(/_/g, " ")}</span>
          <span className="font-mono">v{product.currentVersion}</span>
        </div>
        <div className="flex items-center justify-between pt-2 text-base font-black text-white">
          <span>Total Due</span>
          <span className="font-mono text-emerald-400">{formattedPrice}</span>
        </div>
      </div>

      <div className="p-6 rounded-xl border border-base bg-surface space-y-2">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">
          {product.price === 0 ? "Free resource" : "Paid checkout"}
        </h2>
        <p className="text-xs text-neutral-400">
          {product.price === 0
            ? "No payment details are required."
            : "Paid purchases are temporarily disabled until a production payment provider is connected."}
        </p>
      </div>

      {/* Submit Button */}
      <button
        onClick={handlePay}
        disabled={loading || product.price > 0}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-xl shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
      >
        {loading
          ? "Adding resource..."
          : product.price === 0
            ? "Add to library"
            : "Paid checkout unavailable"}
      </button>

      <div className="flex items-center justify-center gap-2 text-xs text-neutral-500">
        <ShieldCheck className="w-4 h-4 text-emerald-500" />
        <span>No simulated payments or fabricated settlements</span>
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
