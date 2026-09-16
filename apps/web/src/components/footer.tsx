import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-base bg-surface mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-xs">
        <div className="col-span-2">
          <div className="flex items-center space-x-2 mb-3">
            <div className="w-6 h-6 rounded bg-accent flex items-center justify-center font-bold text-white text-[10px]">
              NX
            </div>
            <span className="font-heading text-primary">MTA NEXUS</span>
          </div>
          <p className="text-muted max-w-sm leading-relaxed">
            The unified resource marketplace, licensing platform, and server ecosystem for
            Multi Theft Auto: San Andreas.
          </p>
        </div>

        <div>
          <h4 className="font-label text-primary uppercase mb-3">Ecosystem</h4>
          <ul className="space-y-2 text-muted">
            <li><Link href="/market" className="hover:text-primary transition-colors">Marketplace</Link></li>
            <li><Link href="/servers" className="hover:text-primary transition-colors">Servers</Link></li>
            <li><Link href="/developers" className="hover:text-primary transition-colors">Developers</Link></li>
            <li><Link href="/articles" className="hover:text-primary transition-colors">Articles</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-label text-primary uppercase mb-3">Platform</h4>
          <ul className="space-y-2 text-muted">
            <li><Link href="/workspace" className="hover:text-primary transition-colors">Workspace</Link></li>
            <li><Link href="/explore" className="hover:text-primary transition-colors">Explore</Link></li>
            <li><Link href="/auth/register" className="hover:text-primary transition-colors">Create Account</Link></li>
          </ul>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 border-t border-base flex flex-col sm:flex-row items-center justify-between text-faint">
        <div className="font-caption">© 2026 MTA Nexus. All rights reserved.</div>
        <div className="font-caption">Not affiliated with Rockstar Games or Take-Two Interactive.</div>
      </div>
    </footer>
  );
}
