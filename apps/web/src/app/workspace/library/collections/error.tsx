"use client";

import { Button } from "@nexus/ui";
import { useNexusLocale } from "../../../../components/locale-context";
import { libraryCollectionsCopy } from "../../../../lib/library-collections-i18n";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const { locale } = useNexusLocale(),
    c = libraryCollectionsCopy(locale);
  return (
    <section className="mx-auto max-w-xl space-y-4 py-16">
      <p role="alert">{c.retry}</p>
      <Button type="button" variant="outline" onClick={reset} className="text-accent">
        {c.reload}
      </Button>
    </section>
  );
}
