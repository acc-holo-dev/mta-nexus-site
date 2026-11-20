import { DevelopmentStatusScreen } from "../../features/shell/development-status-server";

export const dynamic = "force-dynamic";

export default async function Page() {
  return DevelopmentStatusScreen();
}
