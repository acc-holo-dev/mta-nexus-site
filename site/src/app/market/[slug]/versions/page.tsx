import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Release history | MTA NEXUS",
  robots: { index: false, follow: false },
};

export { PublicResourceVersionsPage as default } from "../../../../features/resources/versions-server";
