import Link from "next/link";
import { libraryCollectionsCopy } from "../lib/library-collections-i18n";
import { collectionHref } from "../lib/library-collections-query";
import { libraryCollectionsService as service } from "../lib/services/library-collections-service";
import { LibraryCollectionCommandForm } from "./library-collection-command";
import {
  type LibraryCollectionsActor,
  libraryCollectionsLinkClass,
} from "./library-collections-screen-shared";

export async function LibraryCollectionsCopyView({
  locale,
  actor,
  id,
}: {
  locale: "ru" | "en";
  actor: LibraryCollectionsActor;
  id: string;
}) {
  const c = libraryCollectionsCopy(locale);
  const preview = await service.copyPreview(actor, id);
  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
      <Link href={collectionHref(id)} className={libraryCollectionsLinkClass}>
        {c.back}
      </Link>
      <h1 className="font-display">{c.duplicate}</h1>
      <p className="break-words">
        {c.source}: {preview.source.name}
      </p>
      <p>
        {c[preview.source.status]} · {c.revision}: {preview.source.revision} · {c.items}:{" "}
        {preview.itemCount}
      </p>
      <p role="note" className="text-sm text-secondary">
        {c.copyNote}
      </p>
      <p className="text-sm text-muted">{c.limit}</p>
      <LibraryCollectionCommandForm
        key={`copy:${actor.id}:${id}:${preview.source.revision}:${preview.sourceDigest}`}
        actorId={actor.id}
        locale={locale}
        collection={preview.source}
        copyPreview={preview}
        action="duplicate"
      />
      <a
        href={`/api/library/collections/${encodeURIComponent(id)}/copy`}
        className={`text-sm ${libraryCollectionsLinkClass}`}
      >
        {c.json}
      </a>
    </div>
  );
}
