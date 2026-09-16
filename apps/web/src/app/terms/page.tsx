import type { Metadata } from "next";

export const metadata: Metadata = { title: "Closed Beta Terms" };

export default function TermsPage() {
  return (
    <article className="max-w-3xl mx-auto py-10 space-y-7 text-sm leading-7 text-secondary">
      <header className="space-y-2">
        <p className="font-label text-accent uppercase">Closed beta</p>
        <h1 className="text-3xl font-black text-primary">Terms of use</h1>
        <p>Effective for the MTA Nexus closed beta. Last updated: 16 September 2026.</p>
      </header>
      <section><h2 className="text-lg font-bold text-primary">What the beta provides</h2><p>MTA Nexus provides discovery features, community content, server listings, and free resources for Multi Theft Auto. Paid resources, balances, payouts, and cryptocurrency settlement are not available in this beta.</p></section>
      <section><h2 className="text-lg font-bold text-primary">Your account and content</h2><p>You are responsible for activity under your account and for content you submit. Do not upload malware, stolen resources, personal data you do not have the right to share, or content that infringes intellectual-property rights.</p></section>
      <section><h2 className="text-lg font-bold text-primary">Beta availability</h2><p>The service is experimental and may change, be paused, or have data removed while it is being developed. Keep your own copy of every uploaded resource. We do not promise uninterrupted availability during the closed beta.</p></section>
      <section><h2 className="text-lg font-bold text-primary">Moderation</h2><p>We may remove content, limit access, or suspend accounts when needed to protect users, the platform, or rights holders. We will use reasonable judgment and keep an audit trail for moderation actions.</p></section>
      <section><h2 className="text-lg font-bold text-primary">Contact</h2><p>Questions about these terms: <a className="text-accent hover:underline" href="mailto:legal@nexus-mta.com">legal@nexus-mta.com</a>.</p></section>
    </article>
  );
}
