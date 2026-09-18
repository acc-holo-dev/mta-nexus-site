import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy notice" };

export default function PrivacyPage() {
  return (
    <article className="max-w-3xl mx-auto py-10 space-y-7 text-sm leading-7 text-secondary">
      <header className="space-y-2">
        <p className="font-label text-accent uppercase">Closed beta</p>
        <h1 className="text-3xl font-black text-primary">Privacy notice</h1>
        <p>Last updated: 16 September 2026.</p>
      </header>
      <section><h2 className="text-lg font-bold text-primary">Data we use</h2><p>We process account details such as email address, username, display name, password hash, session security data, and any profile, server, resource, or community content you choose to submit. Public server observations may include availability, player counts, MTA version, game mode, map, and the time and public source of the observation.</p></section>
      <section><h2 className="text-lg font-bold text-primary">Why we use it</h2><p>We use this data to operate accounts, prevent abuse, deliver requested resources, display public profiles and servers, maintain security logs, and moderate content. Passwords are never stored in readable form.</p></section>
      <section><h2 className="text-lg font-bold text-primary">Visibility and retention</h2><p>Profile, server, and published resource information can be public according to your chosen visibility settings. Security and audit records are retained only as long as reasonably needed to operate and protect the beta. We do not sell personal data.</p></section>
      <section><h2 className="text-lg font-bold text-primary">Your choices</h2><p>You may request access, correction, or deletion of your account data by contacting us. Some limited data may need to remain temporarily for security, fraud prevention, or legal claims.</p></section>
      <section><h2 className="text-lg font-bold text-primary">Contact</h2><p>Privacy requests: <a className="text-accent hover:underline" href="mailto:legal@nexus-mta.com">legal@nexus-mta.com</a>.</p></section>
    </article>
  );
}
