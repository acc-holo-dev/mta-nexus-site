import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-[#232838] bg-[#090a0f] text-neutral-400 text-xs py-12 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-5 gap-8">
        <div className="col-span-2">
          <div className="flex items-center space-x-2.5 mb-3">
            <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center font-bold text-white text-xs">
              NX
            </div>
            <span className="font-bold text-white tracking-wider">MTA NEXUS</span>
          </div>
          <p className="text-neutral-500 max-w-sm mb-4 leading-relaxed">
            The unified infrastructure and commerce platform for the Multi Theft Auto: San Andreas ecosystem.
            Connecting server owners, developers, creators, and players.
          </p>
          <div className="text-[11px] text-neutral-600 font-mono">
            Nexus Core 1.0.0 • Architecture Monolith • Production Ready
          </div>
        </div>

        <div>
          <h4 className="text-white font-semibold mb-3 uppercase tracking-wider text-[11px]">Ecosystem</h4>
          <ul className="space-y-2">
            <li><Link href="/market" className="hover:text-white transition-colors">Resource Market</Link></li>
            <li><Link href="/servers" className="hover:text-white transition-colors">Server Hub</Link></li>
            <li><Link href="/developers" className="hover:text-white transition-colors">Developer Network</Link></li>
            <li><Link href="/articles" className="hover:text-white transition-colors">Knowledge Base</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-white font-semibold mb-3 uppercase tracking-wider text-[11px]">Developers</h4>
          <ul className="space-y-2">
            <li><Link href="/workspace" className="hover:text-white transition-colors">Developer Portal</Link></li>
            <li><Link href="/articles" className="hover:text-white transition-colors">Nexus Module API</Link></li>
            <li><Link href="/market" className="hover:text-white transition-colors">Sell Resources</Link></li>
            <li><Link href="/workspace" className="hover:text-white transition-colors">Licensing Guide</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-white font-semibold mb-3 uppercase tracking-wider text-[11px]">Security & Legal</h4>
          <ul className="space-y-2">
            <li><Link href="/admin" className="hover:text-white transition-colors">Moderation Center</Link></li>
            <li><Link href="/articles" className="hover:text-white transition-colors">Security Advisories</Link></li>
            <li><Link href="/articles" className="hover:text-white transition-colors">Terms of Service</Link></li>
            <li><Link href="/articles" className="hover:text-white transition-colors">Privacy Policy</Link></li>
          </ul>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 pt-6 border-t border-[#1a1e2b] flex flex-col sm:flex-row items-center justify-between text-neutral-500">
        <div>© 2026 MTA Nexus Ecosystem. All rights reserved.</div>
        <div className="mt-2 sm:mt-0 font-mono text-[11px]">Not affiliated with Rockstar Games or Take-Two Interactive.</div>
      </div>
    </footer>
  );
}
