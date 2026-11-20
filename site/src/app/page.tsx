import { HomePage } from "../features/shell/home-page-server";

export const dynamic = "force-dynamic";

export default async function Page() {
  return HomePage();
}
