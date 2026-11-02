"use client";

import type { ResourceCart, ResourceCartReview } from "@nexus/domain";
import { Button } from "@nexus/ui";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getDictionary } from "../lib/i18n";
import { privateApiRequest } from "../lib/private-api-request";
import { resourceCartReceiptsCopy } from "../lib/resource-cart-receipts-i18n";
import { resourceCartReceiptUrl } from "../lib/resource-cart-receipts-query";
import { confirmedResourceCartReview } from "../lib/resource-cart-review-confirmation";
import {
  confirmedCartAcquisition,
  confirmedResourceCart,
} from "../lib/resource-commerce-confirmation";
import { getResourceCommerceCopy, resourceCommerceError } from "../lib/resource-commerce-i18n";
import { authEntryHref, currentBrowserReturnPath } from "./auth-return-path";
import { confirmAction } from "./confirm-action";
import { GuestAuthLinks } from "./guest-auth-links";
import { useNexusLocale } from "./locale-context";
import { ResourceCartReviewEvidence } from "./resource-cart-review-evidence";

const buttonClass =
  "rounded-lg border border-base px-4 py-2 text-sm font-semibold text-primary hover:bg-hover disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--nexus-accent)]";
const outlineButtonClass =
  "rounded-lg border-base font-semibold text-primary hover:bg-hover disabled:opacity-50";

export function AddResourceToCart({
  productId,
  signedIn,
  returnPath,
}: {
  productId: string;
  signedIn: boolean;
  /** Guest return preserves cart intent without auto-claim after login. */
  returnPath?: string | null;
}) {
  const { locale } = useNexusLocale();
  const copy = getResourceCommerceCopy(locale);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState("");
  const workspaceCopy = getDictionary(locale).workspace;
  const [loginHref, setLoginHref] = useState(authEntryHref("login", returnPath ?? null));
  const [registerHref, setRegisterHref] = useState(authEntryHref("register", returnPath ?? null));
  const lock = useRef(false);
  useEffect(() => {
    const path = returnPath ?? currentBrowserReturnPath();
    setLoginHref(authEntryHref("login", path));
    setRegisterHref(authEntryHref("register", path));
  }, [returnPath]);
  if (!signedIn)
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted">{copy.batchIntent}</p>
        <GuestAuthLinks
          loginHref={loginHref}
          registerHref={registerHref}
          signInLabel={copy.signIn}
          createAccountLabel={workspaceCopy.createAccount}
        />
        <p className="text-xs text-muted">{copy.guestReturnNote}</p>
      </div>
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
    <div className="space-y-2" data-acquire-intent="batch">
      <p className="text-xs text-muted">{copy.batchIntent}</p>
      {added ? (
        <Link href="/workspace/cart" className={`${buttonClass} block text-center`}>
          {copy.added} · {copy.openCart}
        </Link>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => void add()}
          disabled={busy}
          className={`${outlineButtonClass} w-full`}
        >
          {busy ? copy.working : copy.add}
        </Button>
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
  const copy = getResourceCommerceCopy(locale),
    receiptCopy = resourceCartReceiptsCopy(locale);
  const [cart, setCart] = useState(initialCart),
    [review, setReview] = useState<ResourceCartReview | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [receiptId, setReceiptId] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null),
    lock = useRef(false);
  // Retain the full reviewed request on any uncertain response.
  const pending = useRef<{ requestId: string; productIds: string[]; reviewDigest: string } | null>(
    null,
  );
  useEffect(
    () => () => {
      active.current?.abort();
      active.current = null;
    },
    [],
  );
  function current(signal: AbortSignal) {
    return active.current?.signal === signal;
  }
  async function refresh(signal: AbortSignal) {
    const response = await fetch("/api/resources/cart", privateApiRequest({ signal }));
    const body = await response.json().catch(() => null);
    const confirmed = response.ok ? confirmedResourceCart(body) : null;
    if (!confirmed) throw new Error(resourceCommerceError(locale, body?.code));
    if (current(signal)) {
      setCart(confirmed);
      setReview(null);
    }
  }
  async function run(action: (signal: AbortSignal) => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError("");
    try {
      await action(controller.signal);
    } catch (caught) {
      if (current(controller.signal))
        setError(caught instanceof Error ? caught.message : copy.errors.fallback);
    } finally {
      if (current(controller.signal)) {
        active.current = null;
        lock.current = false;
        setBusy(false);
      }
    }
  }
  async function confirmRemove(item: (typeof cart.items)[number]) {
    const objectLabel = item.title ?? copy.unavailable;
    if (
      !(await confirmAction({
        title: copy.removeConfirmTitle,
        object: objectLabel,
        consequences: copy.removeConfirm,
        confirmLabel: copy.remove,
        cancelLabel: copy.cancel,
        closeLabel: copy.cancel,
        danger: true,
      }))
    )
      return;
    void run((signal) => remove(item.productId, signal));
  }
  async function remove(productId: string, signal: AbortSignal) {
    const response = await fetch(
      "/api/resources/cart",
      privateApiRequest({ method: "DELETE", json: { productId }, signal }),
    );
    const body = await response.json().catch(() => null);
    if (!response.ok || body?.productId !== productId || body?.inCart !== false)
      throw new Error(resourceCommerceError(locale, body?.code));
    if (current(signal)) {
      setReview(null);
      setReceiptId(null);
    }
    await refresh(signal);
  }
  async function inspect(signal: AbortSignal) {
    const response = await fetch("/api/resources/cart/review", privateApiRequest({ signal }));
    const body = await response.json().catch(() => null);
    const confirmed = response.ok ? confirmedResourceCartReview(body) : null;
    if (!confirmed) throw new Error(resourceCommerceError(locale, body?.code));
    if (current(signal)) {
      setReview(confirmed);
      setCart({
        items: confirmed.items.map(
          ({ productId, title, slug, version, available, alreadyOwned }) => ({
            productId,
            title,
            slug,
            version,
            available,
            alreadyOwned,
          }),
        ),
        limit: confirmed.limit,
      });
    }
  }
  async function acquire(signal: AbortSignal) {
    if (!pending.current) {
      if (!review?.reviewDigest) throw new Error(receiptCopy.changed);
      pending.current = {
        requestId: crypto.randomUUID(),
        productIds: review.items.map((item) => item.productId),
        reviewDigest: review.reviewDigest,
      };
    }
    const request = pending.current;
    const response = await fetch(
      "/api/resources/cart/acquire",
      privateApiRequest({ method: "POST", json: request, timeoutMs: 30000, signal }),
    );
    const body = await response.json().catch(() => null);
    if (!current(signal)) return;
    if (
      !response.ok ||
      !confirmedCartAcquisition(body, request.productIds) ||
      body.requestId !== request.requestId
    ) {
      if (response.status === 409) {
        pending.current = null;
        setReview(null);
        await refresh(signal);
      }
      throw new Error(
        body?.code === "RESOURCE_CART_REVIEW_CHANGED"
          ? receiptCopy.changed
          : resourceCommerceError(locale, body?.code),
      );
    }
    pending.current = null;
    setReceiptId(request.requestId);
    setReview(null);
    setCart({ items: [], limit: initialCart.limit });
    // A subsequent read failure must not hide the authoritative receipt.
  }
  const uncertain = pending.current !== null,
    unavailable = cart.items.some((item) => !item.available);
  return (
    <div className="space-y-5" aria-busy={busy} data-acquire-intent="batch">
      <p aria-live="polite" className="text-sm text-secondary">
        {copy.cart}: {cart.items.length}/{cart.limit}
      </p>
      <p className="text-sm text-secondary">{copy.batchIntent}</p>
      <p
        role="note"
        className="rounded-lg border border-base bg-surface p-4 text-sm text-secondary"
      >
        {receiptCopy.reviewNote}
      </p>
      {error ? (
        <p
          role="alert"
          className="rounded-lg bg-danger-soft p-4 text-sm text-danger"
          data-cart-state="error"
        >
          {error}
        </p>
      ) : null}
      {receiptId ? (
        <div
          role="status"
          className="rounded-lg bg-success-soft p-4 text-sm text-success"
          data-cart-state="receipt"
        >
          <p>{copy.done}</p>
          <Link href={resourceCartReceiptUrl(receiptId)} className="underline">
            {receiptCopy.receipt}
          </Link>
        </div>
      ) : null}
      {uncertain && !busy ? (
        <p role="status" className="text-sm text-warning" data-cart-state="pending">
          {receiptCopy.pending}
        </p>
      ) : null}
      {!cart.items.length ? (
        <p className="text-secondary">{copy.empty}</p>
      ) : (
        <ul className="space-y-3">
          {cart.items.map((item) => {
            const evidence = review?.items.find((row) => row.productId === item.productId);
            return (
              <li key={item.productId} className="nexus-panel space-y-4 p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
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
                    {item.alreadyOwned ? (
                      <p className="text-sm text-success" data-cart-state="owned">
                        {copy.owned}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy || uncertain}
                    aria-label={`${copy.remove}: ${item.title ?? copy.unavailable}`}
                    onClick={() => void confirmRemove(item)}
                    className={outlineButtonClass}
                  >
                    {copy.remove}
                  </Button>
                </div>
                {evidence?.available ? (
                  <ResourceCartReviewEvidence item={evidence} locale={locale} />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {unavailable ? (
        <p role="status" className="text-sm text-warning">
          {copy.unavailableNote}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        {uncertain ? (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void run(acquire)}
            className={outlineButtonClass}
          >
            {receiptCopy.retry}
          </Button>
        ) : review?.reviewDigest ? (
          <Button type="button" disabled={busy} onClick={() => void run(acquire)}>
            {busy ? copy.working : receiptCopy.confirm}
          </Button>
        ) : cart.items.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            disabled={busy || unavailable}
            onClick={() => void run(inspect)}
            className={outlineButtonClass}
          >
            {busy ? copy.working : receiptCopy.review}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => void run(refresh)}
          className={outlineButtonClass}
        >
          {copy.refresh}
        </Button>
        <Link href="/market" className={buttonClass}>
          {copy.browse}
        </Link>
        <Link href="/workspace/library" className={buttonClass}>
          {copy.library}
        </Link>
        <Link href="/workspace/acquisitions/receipts" className={buttonClass}>
          {receiptCopy.title}
        </Link>
      </div>
    </div>
  );
}
