import type { Metadata } from "next";
import "./globals.css";
import { NexusShell } from "../components/nexus-shell";

export const metadata: Metadata = {
  title: {
    default: "MTA NEXUS — Live Servers, Community & Free Resources",
    template: "%s | MTA NEXUS",
  },
  description:
    "Discover live Multi Theft Auto servers, community updates, and free resources during the MTA Nexus closed beta.",
  openGraph: {
    title: "MTA NEXUS — Live Servers, Community & Free Resources",
    description:
      "A player-first platform for what is happening in MTA right now.",
    type: "website",
  },
};

const themeInitScript = `
(function() {
  try {
    var t = localStorage.getItem('nexus-theme');
    if (t === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {
    document.documentElement.classList.add('dark');
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen bg-page text-primary antialiased">
        <NexusShell>{children}</NexusShell>
      </body>
    </html>
  );
}
