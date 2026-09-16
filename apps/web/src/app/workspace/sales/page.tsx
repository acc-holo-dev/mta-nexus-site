import Link from "next/link";
import { cookies } from "next/headers";
import { orderRepository, productRepository, ledgerRepository } from "@nexus/db";
import { authService } from "../../../lib/services/auth-service";
import { StatCard, SectionHeader, DataTable, DataTableHeader, DataTableBody, DataTableEmpty } from "@nexus/ui";
import { ArrowLeft, DollarSign } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SellerSalesPage() {
  // Session isolation: seller metrics only for the authenticated developer
  const cookieStore = await cookies();
  const token = cookieStore.get("nexus_session")?.value;
  const user = await authService.getSession(token);

  if (!user) {
    return (
      <div className="max-w-md mx-auto py-20 text-center space-y-4">
        <h1 className="font-display text-primary">Sign in required</h1>
        <p className="font-caption text-muted">
          Seller metrics are private. Sign in with your developer account.
        </p>
        <Link
          href="/auth/login"
          className="inline-block px-4 py-2 rounded-md bg-accent hover:bg-[var(--nexus-accent-hover)] text-white text-xs font-semibold transition-colors"
        >
          Sign In
        </Link>
      </div>
    );
  }

  const sales = await orderRepository.listSalesBySeller(user.id);
  const ledgerEntries = (await ledgerRepository.listRecent(200)).filter(
    (e) => e.accountId === `developer:${user.id}`
  );

  const totalRevenue = sales.reduce((sum, s) => sum + s.unitPrice, 0);
  const platformFees = Math.round(totalRevenue * 0.07);
  const netEarnings = totalRevenue - platformFees;

  const payoutBalance = ledgerEntries
    .filter((e) => e.amount > 0)
    .reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-base pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted mb-2">
            <Link href="/workspace" className="hover:text-primary flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" />
              <span>Workspace</span>
            </Link>
            <span>/</span>
            <span className="text-secondary">Sales</span>
          </div>
          <h1 className="font-display text-primary flex items-center gap-2.5">
            <DollarSign className="w-6 h-6 text-success" />
            <span>Seller Dashboard</span>
          </h1>
          <p className="font-caption text-muted mt-1">
            Revenue, completed orders, and payout balance derived from real ledger records.
          </p>
        </div>
      </div>

      {/* Revenue Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Gross Sales" value={`$${(totalRevenue / 100).toFixed(2)}`} />
        <StatCard label="Platform Fee (7%)" value={`$${(platformFees / 100).toFixed(2)}`} tone="warning" />
        <StatCard label="Net Earnings" value={`$${(netEarnings / 100).toFixed(2)}`} tone="success" />
        <StatCard label="Payout Balance" value={`$${(payoutBalance / 100).toFixed(2)}`} tone="accent" />
      </div>

      {/* Sales History */}
      <section>
        <SectionHeader title={`Completed Sales (${sales.length})`} description="Derived from immutable ledger" />
        <div className="nexus-panel p-4">
          <DataTable>
            <DataTableHeader columns={["Date", "Order", "Product", "Amount"]} />
            <DataTableBody>
              {sales.length > 0 ? (
                sales.map((sale) => (
                  <tr key={`${sale.orderId}-${sale.productId}`}>
                    <td className="py-2.5 pr-4 text-faint">
                      {new Date(sale.createdAt).toLocaleDateString()}
                    </td>
                    <td className="pr-4 text-muted">#{sale.orderNumber}</td>
                    <td className="pr-4">
                      <Link href={`/market/${sale.productSlug}`} className="hover:text-primary">
                        {sale.productTitle}
                      </Link>
                    </td>
                    <td className="text-right font-bold text-success">
                      +${(sale.unitPrice / 100).toFixed(2)}
                    </td>
                  </tr>
                ))
              ) : (
                <DataTableEmpty
                  colSpan={4}
                  message="No completed sales yet. Publish and promote your products to start earning."
                />
              )}
            </DataTableBody>
          </DataTable>
        </div>
      </section>
    </div>
  );
}
