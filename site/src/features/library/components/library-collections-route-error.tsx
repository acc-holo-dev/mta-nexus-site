"use client";

import { Button, ErrorState } from "@nexus/ui";
import { useNexusLocale } from "../../shell/locale";
import { pageShellMaxXl } from "../../shell/page-shell";
import { libraryCollectionsCopy } from "../library-collections-i18n";

export function LibraryCollectionsRouteError({ reset }: { reset: () => void }) {
  const { locale } = useNexusLocale();
  const typedLocale: "en" | "ru" = locale === "ru" ? "ru" : "en";
  const c = libraryCollectionsCopy(typedLocale);
  return (
    <section className={pageShellMaxXl}>
      <ErrorState
        title={c.retry}
        description={c.loadUnavailableDescription}
        action={
          <Button type="button" variant="outline" size="touch" onClick={reset}>
            {c.reload}
          </Button>
        }
      />
    </section>
  );
}
