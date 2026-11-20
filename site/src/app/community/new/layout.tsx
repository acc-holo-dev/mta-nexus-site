import { newTopicLayoutMetadata } from "../../../features/community/new-topic-layout-metadata-server";

export const generateMetadata = newTopicLayoutMetadata;

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
