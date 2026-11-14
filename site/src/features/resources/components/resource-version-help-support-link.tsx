"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  type SupportFormObjectContext,
  supportObjectContextHref,
} from "../../../components/support-center";

export function ResourceVersionHelpSupportLink({
  context,
  className,
  children,
}: {
  context: SupportFormObjectContext;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={supportObjectContextHref(context)} className={className}>
      {children}
    </Link>
  );
}
