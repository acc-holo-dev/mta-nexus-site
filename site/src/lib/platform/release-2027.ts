import {
  isWalletEngineEnabled,
  isWalletWithdrawEnabled,
} from "../services/commerce/wallet-payment-service";

/**
 * Operator-facing release profile for the 2027 single-instance line.
 * Describes what this build can honestly run for a busy community (~10k daily
 * sessions): paginated staff queues, RUB settlement labels, and dark wallet
 * flags. It does not enable card checkout, live PSP, or a production deploy.
 */
export type Release2027Profile = {
  id: "2027-single-instance";
  settlementCurrency: "RUB";
  displayCurrencies: readonly ["RUB"];
  cardCheckout: "disabled";
  siteWallet: "off" | "engine" | "engine_and_withdraw";
  staffQueues: "paginated";
  audit: "required_for_mutations";
};

export function release2027Profile(
  env: Record<string, string | undefined> = process.env,
): Release2027Profile {
  const engine = isWalletEngineEnabled(env);
  const withdraw = isWalletWithdrawEnabled(env);
  return {
    id: "2027-single-instance",
    settlementCurrency: "RUB",
    displayCurrencies: ["RUB"],
    cardCheckout: "disabled",
    siteWallet: withdraw ? "engine_and_withdraw" : engine ? "engine" : "off",
    staffQueues: "paginated",
    audit: "required_for_mutations",
  };
}
