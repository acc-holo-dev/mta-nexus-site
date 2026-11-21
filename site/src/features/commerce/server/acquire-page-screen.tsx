import { cookies } from "next/headers";
import { authService } from "../../../lib/services/accounts/auth-service";
import { isWalletEngineEnabled } from "../../../lib/services/commerce/wallet-payment-service";
import { AcquirePage } from "../acquire-page";

/** RSC shell: session + wallet flag for the client acquire surface. */
export async function AcquirePageScreen() {
  const store = await cookies();
  let user: Awaited<ReturnType<typeof authService.getSession>> = null;
  try {
    user = await authService.getSession(store.get("nexus_session")?.value);
  } catch {
    user = null;
  }
  return (
    <AcquirePage
      walletEnabled={isWalletEngineEnabled()}
      actorId={user?.id ?? null}
      signedIn={Boolean(user)}
    />
  );
}
