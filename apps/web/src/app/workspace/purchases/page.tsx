import Link from "next/link";
import { orderRepository, productRepository } from "@nexus/db";
import { CreditCard, ArrowLeft, PackageCheck, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PurchasesPage() {
  const orders = await orderRepository.listAll();
  const products = await productRepository.list();
  const productMap = new Map(products.map((p) => [p.id, p]));

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
            <span className="text-neutral-200">Purchases</span>
          </div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <CreditCard className="w-6 h-6 text-blue-500" />
            <span>Order & Purchase History</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Review completed commercial transactions, invoices, and associated licenses.
          </p>
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {orders.length > 0 ? (
          orders.map((order) => (
            <div
              key={order.id}
              className="p-5 rounded-xl border border-[#232838] bg-[#11131a] space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <PackageCheck className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-sm text-white">Order #{order.orderNumber}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {order.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-neutral-400 font-mono">
                  <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                  <span className="font-bold text-white text-sm">
                    ${(order.totalAmount / 100).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Order Items */}
              <div className="space-y-2">
                {order.items?.map((item) => {
                  const prod = productMap.get(item.productId);
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between py-1 text-xs text-neutral-300"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-200 font-medium">
                          {prod?.title || `Product (${item.productId})`}
                        </span>
                        {prod && (
                          <Link
                            href={`/market/${prod.slug}`}
                            className="text-blue-400 hover:underline"
                            title="View product"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}
                      </div>
                      <span className="font-mono text-neutral-400">
                        ${(item.unitPrice / 100).toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 flex justify-end">
                <Link
                  href="/workspace/licenses"
                  className="text-xs text-blue-400 hover:underline font-semibold"
                >
                  View Active License →
                </Link>
              </div>
            </div>
          ))
        ) : (
          <div className="py-16 text-center rounded-xl border border-dashed border-[#232838] bg-[#11131a]/40">
            <p className="text-sm text-neutral-400">No purchase records found.</p>
            <Link
              href="/market"
              className="inline-block mt-3 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white transition-colors"
            >
              Explore Marketplace
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
