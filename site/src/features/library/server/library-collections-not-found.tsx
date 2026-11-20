import Link from "next/link";
import { getRequestLocale } from "../../../lib/i18n/server";
import { linkAccentRounded } from "../../shell/link-shell";
import { pageShellMaxXl } from "../../shell/page-shell";
import { typeDisplayPrimary } from "../../shell/type-shell";
import { libraryCollectionsCopy } from "../library-collections-i18n";

export async function LibraryCollectionsNotFound() {
  const c = libraryCollectionsCopy(await getRequestLocale());
  return (
    <section className={pageShellMaxXl}>
      <h1 className={typeDisplayPrimary}>{c.notFound}</h1>
      <Link href="/workspace/library/collections" className={linkAccentRounded}>
        {c.title}
      </Link>
    </section>
  );
}
