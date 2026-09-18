import type { Metadata } from "next";

export const metadata: Metadata = { title: "Copyright & abuse" };

export default function CopyrightPage() {
  return (
    <article className="max-w-3xl mx-auto py-10 space-y-7 text-sm leading-7 text-secondary">
      <header className="space-y-2">
        <p className="font-label text-accent uppercase">Closed beta</p>
        <h1 className="text-3xl font-black text-primary">Copyright & abuse reports</h1>
        <p>Last updated: 16 September 2026.</p>
      </header>
      <section><h2 className="text-lg font-bold text-primary">Report harmful or infringing content</h2><p>Use this channel to report copyright infringement, impersonation, malware, stolen resources, or other abuse. Include the URL or resource identifier, a clear explanation, and material supporting your report. Do not send passwords or private keys.</p></section>
      <section><h2 className="text-lg font-bold text-primary">Our response</h2><p>We review reports, preserve relevant audit evidence, and may temporarily restrict content or accounts while investigating. Repeat or serious violations may lead to removal and suspension.</p></section>
      <section><h2 className="text-lg font-bold text-primary">Important platform notice</h2><p>MTA Nexus is an independent community platform. It is not affiliated with Rockstar Games, Take-Two Interactive, or the Multi Theft Auto project.</p></section>
      <section><h2 className="text-lg font-bold text-primary">Contact</h2><p>Copyright and abuse reports: <a className="text-accent hover:underline" href="mailto:abuse@nexus-mta.com">abuse@nexus-mta.com</a>.</p></section>
    </article>
  );
}
