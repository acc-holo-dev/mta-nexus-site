import type { Metadata } from "next";
import "./globals.css";
import { NexusShell } from "../components/nexus-shell";

export const metadata: Metadata = {
  title: {
    default: "MTA NEXUS — Resource Marketplace & Server Ecosystem for MTA:SA",
    template: "%s | MTA NEXUS",
  },
  description:
    "Buy, license, and publish Multi Theft Auto resources. Discover servers, developers, and verified scripts with cryptographic licensing.",
  openGraph: {
    title: "MTA NEXUS — Resource Marketplace & Server Ecosystem",
    description:
      "The unified platform for MTA:SA servers, scripters, studios, and players.",
    type: "website",
  },
};

// Theme init: apply persisted theme before paint to avoid flash
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
