import { settingsLayoutMetadata } from "../../features/accounts/settings-layout-metadata-server";

export const generateMetadata = settingsLayoutMetadata;

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
