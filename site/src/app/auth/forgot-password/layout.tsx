import { forgotPasswordLayoutMetadata } from "../../../features/accounts/recovery-layout-metadata-server";

export const generateMetadata = forgotPasswordLayoutMetadata;

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
