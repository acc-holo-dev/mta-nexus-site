import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-base bg-surface mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-xs">
        <div className="col-span-2">
          <div className="flex items-center space-x-2 mb-3">
            <div className="w-6 h-6 rounded bg-accent flex items-center justify-center font-bold text-white text-[10px]">NX</div>
            <span className="font-heading text-primary">MTA NEXUS</span>
          </div>
          <p className="text-muted max-w-sm leading-relaxed">
            Live MTA server activity, community updates, and free resources in one place.
            Paid commerce is not enabled during the closed beta.
          </p>
        </div>
        <div>
          <h4 className="font-label text-primary uppercase mb-3">Discover</h4>
          <ul className="space-y-2 text-muted">
            <li><Link href="/servers" className="hover:text-primary">Live servers</Link></li>
            <li><Link href="/market" className="hover:text-primary">Free resources</Link></li>
            <li><Link href="/articles" className="hover:text-primary">Community updates</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-label text-primary uppercase mb-3">Contribute</h4>
          <ul className="space-y-2 text-muted">
            <li><Link href="/workspace/servers/new" className="hover:text-primary">Register a server</Link></li>
            <li><Link href="/workspace/resources/new" className="hover:text-primary">Publish a resource</Link></li>
            <li><Link href="/workspace" className="hover:text-primary">Workspace</Link></li>
          </ul>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 border-t border-base flex flex-col sm:flex-row items-center justify-between text-faint gap-2">
        <div className="font-caption">© 2026 MTA Nexus · Closed beta</div>
        <div className="flex items-center gap-3 font-caption">
          <Link href="/terms" className="hover:text-primary">Terms</Link>
          <Link href="/privacy" className="hover:text-primary">Privacy</Link>
          <Link href="/copyright" className="hover:text-primary">Copyright</Link>
        </div>
        <div className="font-caption">Not affiliated with Rockstar Games, Take-Two Interactive, or Multi Theft Auto.</div>
      </div>
    </footer>
  );
}
