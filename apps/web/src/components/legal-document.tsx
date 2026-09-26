type LegalSection = Readonly<{
  title: string;
  body: string;
}>;

export function LegalDocument({
  badge,
  title,
  lead,
  lastUpdatedLabel,
  updated,
  sections,
  contactLabel,
  contactEmail,
}: {
  badge: string;
  title: string;
  lead: string;
  lastUpdatedLabel: string;
  updated: string;
  sections: readonly LegalSection[];
  contactLabel: string;
  contactEmail: string;
}) {
  return (
    <article className="mx-auto max-w-3xl space-y-7 py-10 text-sm leading-7 text-secondary">
      <header className="nexus-panel space-y-3 p-6 shadow-nexus-sm">
        <p className="font-label uppercase text-accent">{badge}</p>
        <h1 className="text-3xl font-black text-primary">{title}</h1>
        <p className="max-w-2xl text-muted">{lead}</p>
        <p className="font-caption text-faint">
          {lastUpdatedLabel}: {updated}
        </p>
      </header>

      {sections.map((section) => (
        <section
          key={section.title}
          className="space-y-2 border-b border-base pb-6 last:border-b-0"
        >
          <h2 className="text-lg font-bold text-primary">{section.title}</h2>
          <p>{section.body}</p>
        </section>
      ))}

      <section className="nexus-panel p-5">
        <h2 className="text-sm font-bold text-primary">{contactLabel}</h2>
        <a
          className="mt-1 inline-block font-semibold text-accent hover:underline"
          href={`mailto:${contactEmail}`}
        >
          {contactEmail}
        </a>
      </section>
    </article>
  );
}
