import Link from "next/link";
import { cookies } from "next/headers";
import { orderRepository, productRepository } from "@nexus/db";
import { authService } from "../../../lib/services/auth-service";
import { DataTable, DataTableHeader, DataTableBody, DataTableEmpty, StatusBadge, SectionHeader } from "@nexus/ui";
import { ArrowLeft, CreditCard, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PurchasesPage() {
  // Session isolation: a user only sees their own orders (PLAN-003 TASK-012)
  const cookieStore = await cookies();
  const token = cookieStore.get("nexus_session")?.value;
  const user = await authService.getSession(token);

  if (!user) {
    return (
      <div className="max-w-md mx-auto py-20 text-center space-y-4">
        <h1 className="font-display text-primary">Sign in required</h1>
        <p className="font-caption text-muted">
          Purchase history is private. Sign in to view your orders.
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

  const orders = await orderRepository.listByUser(user.id);
  const products = await productRepository.list();
  const productMap = new Map(products.map((p) => [p.id, p]));

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
            <span className="text-secondary">Purchases</span>
          </div>
          <h1 className="font-display text-primary flex items-center gap-2.5">
            <CreditCard className="w-6 h-6 text-accent" />
            <span>Order History</span>
          </h1>
          <p className="font-caption text-muted mt-1">
            Your private purchase records and associated licenses.
          </p>
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {orders.length > 0 ? (
          orders.map((order) => (
            <div key={order.id} className="nexus-panel p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-base pb-3">
                <div className="flex items-center gap-2">
                  <span className="font-heading text-sm text-primary">
                    Order #{order.orderNumber}
                  </span>
                  <StatusBadge
                    status={order.status}
                    tone={order.status === "completed" ? "success" : "warning"}
                  />
                </div>
                <div className="flex items-center gap-4 font-caption text-muted">
                  <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                  <span className="font-numeric font-bold text-primary">
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
                      className="flex items-center justify-between py-1 text-xs text-secondary"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {prod?.title || `Product (${item.productId})`}
                        </span>
                        {prod && (
                          <Link
                            href={`/market/${prod.slug}`}
                            className="text-accent hover:underline"
                            title="View product"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}
                      </div>
                      <span className="font-numeric text-muted">
                        ${(item.unitPrice / 100).toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 flex justify-end">
                <Link
                  href="/workspace/licenses"
                  className="text-xs text-accent hover:underline font-semibold"
                >
                  View License →
                </Link>
              </div>
            </div>
          ))
        ) : (
          <div className="py-16 text-center nexus-panel">
            <p className="font-caption text-muted">No purchase records found.</p>
            <Link
              href="/market"
              className="inline-block mt-3 px-4 py-2 rounded-md bg-accent hover:bg-[var(--nexus-accent-hover)] text-white text-xs font-semibold transition-colors"
            >
              Explore Marketplace
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
