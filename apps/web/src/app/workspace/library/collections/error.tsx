"use client";
import { useNexusLocale } from "../../../../components/locale-context";
import { libraryCollectionsCopy } from "../../../../lib/library-collections-i18n";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const { locale } = useNexusLocale(),
    c = libraryCollectionsCopy(locale);
  return (
    <section className="mx-auto max-w-xl space-y-4 py-16">
      <p role="alert">{c.retry}</p>
      <button
        type="button"
        onClick={reset}
        className="rounded border border-base px-4 py-2 text-accent"
      >
        {c.reload}
      </button>
    </section>
  );
}
