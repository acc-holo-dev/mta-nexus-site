import { pageShellMax5xl } from "../../shell/page-shell";
import { LocaleCopyRouteLoading } from "../../shell/route-honest-loading-server";
import { skelH10W72Max } from "../../shell/skeleton-shell";
import { getWalletCopy } from "../wallet-i18n";

export function AdminPromoRouteLoading() {
  return LocaleCopyRouteLoading({
    headingId: "admin-promo-codes-loading-heading",
    className: pageShellMax5xl,
    rows: 4,
    leading: <div className={skelH10W72Max} />,
    load: (locale) => {
      const copy = getWalletCopy(locale === "ru" ? "ru" : "en");
      return {
        title: copy.promoTitle,
        loading: copy.promoLoading,
      };
    },
  });
}
