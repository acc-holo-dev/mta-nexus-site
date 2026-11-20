import { verifyEmailLayoutMetadata } from "../../../features/accounts/recovery-layout-metadata-server";

export const generateMetadata = verifyEmailLayoutMetadata;

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
