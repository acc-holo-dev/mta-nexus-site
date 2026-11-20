import { resetPasswordLayoutMetadata } from "../../../features/accounts/recovery-layout-metadata-server";

export const generateMetadata = resetPasswordLayoutMetadata;

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
