"use client";

import Link from "next/link";
import { type SupportFormObjectContext, supportObjectContextHref } from "./support-center";

function downloadSupportContext(value: {
  productId: string;
  buildId: string;
  receiptId: string;
}): SupportFormObjectContext | null {
  if (!/^prd_[a-f0-9]{24}$/u.test(value.productId)) return null;
  if (!/^bld_[a-f0-9]{24}$/u.test(value.buildId)) return null;
  if (!/^dlv_[a-f0-9]{24}$/u.test(value.receiptId)) return null;
  return value;
}

/** Stashes the verified download ids, then opens a resource support case. */
export function SupportDownloadHelpLink({
  productId,
  buildId,
  receiptId,
  label,
}: {
  productId: string;
  buildId: string;
  receiptId: string;
  label: string;
}) {
  const context = downloadSupportContext({ productId, buildId, receiptId });
  if (!context) return null;
  return (
    <Link
      href={supportObjectContextHref(context)}
      className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
    >
      {label}
    </Link>
  );
}
