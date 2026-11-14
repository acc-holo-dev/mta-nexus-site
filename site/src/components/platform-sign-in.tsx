"use client";

import { usePathname } from "next/navigation";
import type { Locale } from "../lib/i18n";
import {
  PlatformWorkspaceGuestAuthLinks,
  PlatformWorkspaceSignInCopy,
} from "./platform-workspace-guest-auth";

export function PlatformSignIn({
  locale,
  returnPath,
}: {
  locale: Locale;
  returnPath?: string | null;
}) {
  const pathname = usePathname();
  const nextPath = returnPath !== undefined ? returnPath : pathname;
  return (
    <section className="space-y-4 py-16 text-center">
      <PlatformWorkspaceSignInCopy locale={locale} variant="page-title" />
      <PlatformWorkspaceGuestAuthLinks
        locale={locale}
        returnPath={nextPath}
        linkClassName="justify-center"
      />
    </section>
  );
}
