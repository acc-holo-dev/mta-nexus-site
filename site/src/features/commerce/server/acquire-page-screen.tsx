import { cookies } from "next/headers";
import { authService } from "../../../lib/services/accounts/auth-service";
import {
  isWalletEngineEnabled,
  WalletPaymentService,
} from "../../../lib/services/commerce/wallet-payment-service";
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
  const walletEnabled = isWalletEngineEnabled();
  const fxRates = walletEnabled
    ? await new WalletPaymentService().listFxRates().catch(() => null)
    : undefined;
  return (
    <AcquirePage
      walletEnabled={walletEnabled}
      actorId={user?.id ?? null}
      signedIn={Boolean(user)}
      fxRates={fxRates}
    />
  );
}
