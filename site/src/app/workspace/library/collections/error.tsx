"use client";

import { Button, ErrorState } from "@nexus/ui";
import { useNexusLocale } from "../../../../components/locale-context";
import { libraryCollectionsCopy } from "../../../../lib/library-collections-i18n";

export default function ErrorPage({ reset }: { reset: () => void }) {
  const { locale } = useNexusLocale();
  const typedLocale: "en" | "ru" = locale === "ru" ? "ru" : "en";
  const c = libraryCollectionsCopy(typedLocale);
  return (
    <section className="mx-auto min-w-0 max-w-xl space-y-4 overflow-x-clip py-16">
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
