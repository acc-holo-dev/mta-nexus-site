"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { ResourceCart } from "@nexus/domain";
import { useNexusLocale } from "./locale-context";
import { privateApiRequest } from "../lib/private-api-request";
import { getResourceCommerceCopy, resourceCommerceError } from "../lib/resource-commerce-i18n";
import {
  confirmedCartAcquisition,
  confirmedResourceCart,
} from "../lib/resource-commerce-confirmation";

const buttonClass =
  "rounded-lg border border-base px-4 py-2 text-sm font-semibold text-primary hover:bg-hover disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--nexus-accent)]";

export function AddResourceToCart({
  productId,
  signedIn,
}: {
  productId: string;
  signedIn: boolean;
}) {
  const { locale } = useNexusLocale();
  const copy = getResourceCommerceCopy(locale);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  if (!signedIn)
    return (
      <Link href="/auth/login" className={buttonClass}>
        {copy.signIn}
      </Link>
    );
  async function add() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        "/api/resources/cart",
        privateApiRequest({ method: "POST", json: { productId } }),
      );
      const body = await response.json().catch(() => null);
      if (!response.ok || body?.productId !== productId || body?.inCart !== true) {
        setError(resourceCommerceError(locale, body?.code));
        return;
      }
      setAdded(true);
    } catch {
      setError(copy.errors.fallback);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2">
      {added ? (
        <Link href="/workspace/cart" className={`${buttonClass} block text-center`}>
          {copy.added} · {copy.openCart}
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => void add()}
          disabled={busy}
          className={`${buttonClass} w-full`}
        >
          {busy ? copy.working : copy.add}
        </button>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function ResourceCartControls({ initialCart }: { initialCart: ResourceCart }) {
  const { locale } = useNexusLocale();
  const copy = getResourceCommerceCopy(locale);
  const [cart, setCart] = useState(initialCart);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const lock = useRef(false);
  // Retain this key on an uncertain response. The durable server receipt makes
  // retry safe even when the original transaction committed and cleared the cart.
  const pending = useRef<{ requestId: string; productIds: string[] } | null>(null);

  async function refresh() {
    const response = await fetch("/api/resources/cart", privateApiRequest());
    const body = await response.json().catch(() => null);
    const confirmed = response.ok ? confirmedResourceCart(body) : null;
    if (!confirmed) throw new Error(resourceCommerceError(locale, body?.code));
    setCart(confirmed);
    return confirmed;
  }

  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : copy.errors.fallback);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function remove(productId: string) {
    const response = await fetch(
      "/api/resources/cart",
      privateApiRequest({ method: "DELETE", json: { productId } }),
    );
    const body = await response.json().catch(() => null);
    if (!response.ok || body?.productId !== productId || body?.inCart !== false)
      throw new Error(resourceCommerceError(locale, body?.code));
    pending.current = null;
    setDone(false);
    await refresh();
  }

  async function acquire() {
    if (!pending.current)
      pending.current = {
        requestId: crypto.randomUUID(),
        productIds: cart.items.map((item) => item.productId),
      };
    const request = pending.current;
    const response = await fetch(
      "/api/resources/cart/acquire",
      privateApiRequest({ method: "POST", json: request, timeoutMs: 30_000 }),
    );
    const body = await response.json().catch(() => null);
    if (!response.ok || !confirmedCartAcquisition(body, request.productIds)) {
      if (response.status === 409) pending.current = null;
      throw new Error(resourceCommerceError(locale, body?.code));
    }
    pending.current = null;
    setDone(true);
    setCart({ items: [], limit: initialCart.limit });
    await refresh();
  }

  const unavailable = cart.items.some((item) => !item.available);
  return (
    <div className="space-y-5" aria-busy={busy}>
      <p aria-live="polite" className="text-sm text-secondary">
        {copy.cart}: {cart.items.length}/{cart.limit}
      </p>
      <p className="rounded-lg border border-base bg-surface p-4 text-sm text-secondary">
        {copy.note}
      </p>
      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft p-4 text-sm text-danger">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="rounded-lg bg-success-soft p-4 text-sm text-success">
          {copy.done}
        </p>
      )}
      {cart.items.length === 0 ? (
        <p className="text-secondary">{copy.empty}</p>
      ) : (
        <ul className="space-y-3">
          {cart.items.map((item) => (
            <li
              key={item.productId}
              className="nexus-panel flex flex-wrap items-center justify-between gap-4 p-5"
            >
              <div className="min-w-0 space-y-2">
                {item.available && item.slug ? (
                  <Link
                    href={`/market/${item.slug}`}
                    className="break-words font-semibold text-primary hover:text-accent"
                  >
                    {item.title}
                  </Link>
                ) : (
                  <p className="text-danger">{copy.unavailable}</p>
                )}
                <p className="text-sm text-muted">
                  {item.available ? `${copy.free} · ${item.version}` : copy.unavailableNote}
                </p>
                {item.alreadyOwned && <p className="text-sm text-success">{copy.owned}</p>}
              </div>
              <button
                type="button"
                disabled={busy}
                aria-label={`${copy.remove}: ${item.title ?? copy.unavailable}`}
                onClick={() => void run(() => remove(item.productId))}
                className={buttonClass}
              >
                {copy.remove}
              </button>
            </li>
          ))}
        </ul>
      )}
      {unavailable && (
        <p role="status" className="text-sm text-warning">
          {copy.unavailableNote}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        {(cart.items.length > 0 || pending.current !== null) && (
          <button
            type="button"
            disabled={busy || (unavailable && pending.current === null)}
            onClick={() => void run(acquire)}
            className={`${buttonClass} bg-accent text-white`}
          >
            {busy ? copy.working : copy.acquire}
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await refresh();
            })
          }
          className={buttonClass}
        >
          {copy.refresh}
        </button>
        <Link href="/market" className={buttonClass}>
          {copy.browse}
        </Link>
        <Link href="/workspace/library" className={buttonClass}>
          {copy.library}
        </Link>
      </div>
    </div>
  );
}
