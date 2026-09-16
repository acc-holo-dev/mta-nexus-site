import Link from "next/link";
import { orderRepository, productRepository, ledgerRepository } from "@nexus/db";
import { DollarSign, ShoppingBag, ArrowLeft, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SellerSalesPage() {
  // Seller commerce history derived from real order and ledger records
  const developerProducts = await productRepository.list();
  const sellerId = developerProducts[0]?.authorId;

  const sales = sellerId ? await orderRepository.listSalesBySeller(sellerId) : [];
  const ledgerEntries = sellerId
    ? (await ledgerRepository.listRecent(200)).filter((e) => e.accountId === `developer:${sellerId}`)
    : [];

  const totalRevenue = sales.reduce((sum, s) => sum + s.unitPrice, 0);
  const platformFees = Math.round(totalRevenue * 0.07);
  const netEarnings = totalRevenue - platformFees;

  const payoutBalance = ledgerEntries
    .filter((e) => e.amount > 0)
    .reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#232838] pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-neutral-400 mb-2">
            <Link href="/workspace" className="hover:text-white flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" />
              <span>Workspace</span>
            </Link>
            <span>/</span>
            <span className="text-neutral-200">Sales</span>
          </div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <DollarSign className="w-6 h-6 text-emerald-500" />
            <span>Seller Dashboard</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Revenue, completed orders, and payout balance derived from real ledger records.
          </p>
        </div>
      </div>

      {/* Revenue Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-[#232838] bg-[#11131a]">
          <div className="text-[11px] text-neutral-500 uppercase tracking-wider">Gross Sales</div>
          <div className="text-2xl font-black text-white mt-1 font-mono">
            ${(totalRevenue / 100).toFixed(2)}
          </div>
        </div>
        <div className="p-4 rounded-xl border border-[#232838] bg-[#11131a]">
          <div className="text-[11px] text-neutral-500 uppercase tracking-wider">Platform Fee (7%)</div>
          <div className="text-2xl font-black text-amber-400 mt-1 font-mono">
            ${(platformFees / 100).toFixed(2)}
          </div>
        </div>
        <div className="p-4 rounded-xl border border-[#232838] bg-[#11131a]">
          <div className="text-[11px] text-neutral-500 uppercase tracking-wider">Net Earnings</div>
          <div className="text-2xl font-black text-emerald-400 mt-1 font-mono">
            ${(netEarnings / 100).toFixed(2)}
          </div>
        </div>
        <div className="p-4 rounded-xl border border-[#232838] bg-[#11131a]">
          <div className="text-[11px] text-neutral-500 uppercase tracking-wider">Payout Balance</div>
          <div className="text-2xl font-black text-blue-400 mt-1 font-mono">
            ${(payoutBalance / 100).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Sales History */}
      <div className="p-6 rounded-xl border border-[#232838] bg-[#11131a] space-y-4">
        <div className="flex items-center justify-between border-b border-[#232838] pb-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-emerald-400" />
            <span>Completed Sales ({sales.length})</span>
          </h2>
          <span className="text-[11px] text-neutral-500 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            Derived from immutable ledger
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] text-neutral-500 uppercase border-b border-neutral-800">
              <tr>
                <th className="py-2.5">Date</th>
                <th>Order</th>
                <th>Product</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60 font-mono text-neutral-300">
              {sales.length > 0 ? (
                sales.map((sale) => (
                  <tr key={`${sale.orderId}-${sale.productId}`}>
                    <td className="py-2.5 text-neutral-500">
                      {new Date(sale.createdAt).toLocaleDateString()}
                    </td>
                    <td className="text-neutral-400">#{sale.orderNumber}</td>
                    <td>
                      <Link href={`/market/${sale.productSlug}`} className="hover:text-white">
                        {sale.productTitle}
                      </Link>
                    </td>
                    <td className="text-right font-bold text-emerald-400">
                      +${(sale.unitPrice / 100).toFixed(2)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-neutral-500">
                    No completed sales yet. Publish and promote your products to start earning.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
