import Link from "next/link";
import { getDictionary, type Locale } from "../lib/i18n";

export function Footer({ locale }: { locale: Locale }) {
  const dictionary = getDictionary(locale);

  return (
    <footer className="mb-16 mt-12 border-t border-base bg-surface lg:mb-0">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-10 text-xs sm:px-6 lg:grid-cols-4 lg:px-8">
        <div className="col-span-2">
          <div className="mb-3 flex items-center space-x-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-accent text-[10px] font-bold text-white">
              NX
            </div>
            <span className="font-heading text-primary">MTA NEXUS</span>
          </div>
          <p className="max-w-sm leading-relaxed text-muted">{dictionary.footer.summary}</p>
        </div>
        <div>
          <h4 className="mb-3 font-label uppercase text-primary">{dictionary.footer.discover}</h4>
          <ul className="space-y-2 text-muted">
            <li>
              <Link
                href="/servers"
                className="rounded-sm transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              >
                {dictionary.footer.liveServers}
              </Link>
            </li>
            <li>
              <Link
                href="/market"
                className="rounded-sm transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              >
                {dictionary.footer.freeResources}
              </Link>
            </li>
            <li>
              <Link
                href="/articles"
                className="rounded-sm transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              >
                {dictionary.footer.communityUpdates}
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 font-label uppercase text-primary">{dictionary.footer.contribute}</h4>
          <ul className="space-y-2 text-muted">
            <li>
              <Link
                href="/workspace/servers/new"
                className="rounded-sm transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              >
                {dictionary.footer.registerServer}
              </Link>
            </li>
            <li>
              <Link
                href="/workspace/resources/new"
                className="rounded-sm transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              >
                {dictionary.footer.publishResource}
              </Link>
            </li>
            <li>
              <Link
                href="/workspace"
                className="rounded-sm transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              >
                {dictionary.footer.workspace}
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 border-t border-base px-4 py-4 text-faint sm:flex-row sm:px-6 lg:px-8">
        <div className="font-caption">© 2026 MTA Nexus · {dictionary.nav.closedBeta}</div>
        <div className="flex items-center gap-3 font-caption">
          <Link
            href="/terms"
            className="rounded-sm transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          >
            {dictionary.footer.terms}
          </Link>
          <Link
            href="/privacy"
            className="rounded-sm transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          >
            {dictionary.footer.privacy}
          </Link>
          <Link
            href="/copyright"
            className="rounded-sm transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          >
            {dictionary.footer.copyright}
          </Link>
        </div>
        <div className="font-caption">{dictionary.footer.disclaimer}</div>
      </div>
    </footer>
  );
}
