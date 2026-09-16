import Link from "next/link";
import { cookies } from "next/headers";
import {
  licenseRepository,
  serverRepository,
  productRepository,
  ledgerRepository,
  orderRepository,
} from "@nexus/db";
import { authService } from "../../lib/services/auth-service";
import {
  StatCard,
  SectionHeader,
  DataTable,
  DataTableHeader,
  DataTableBody,
  DataTableEmpty,
  StatusBadge,
} from "@nexus/ui";
import {
  Key,
  Server as ServerIcon,
  History,
  Plus,
  DollarSign,
  Users,
  ShoppingBag,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function WorkspacePage() {
  // Session isolation: overview shows only the current user's data
  const cookieStore = await cookies();
  const token = cookieStore.get("nexus_session")?.value;
  const user = await authService.getSession(token);

  if (!user) {
    return (
      <div className="max-w-md mx-auto py-20 text-center space-y-4">
        <h1 className="font-display text-primary">Sign in required</h1>
        <p className="font-caption text-muted">
          The workspace contains your private licenses, purchases and financial records.
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

  const [licenses, servers, products, ledger, sales] = await Promise.all([
    licenseRepository.listByUser(user.id),
    serverRepository.listActivePublic(),
    productRepository.list(),
    ledgerRepository.listRecent(10),
    orderRepository.listSalesBySeller(user.id),
  ]);

  const productMap = new Map(products.map((p) => [p.id, p]));
  const activeLicenses = licenses.filter((l) => l.status === "active");
  const totalPlayers = servers.reduce((acc, s) => acc + s.currentPlayers, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-primary">Workspace</h1>
          <p className="font-caption text-muted mt-0.5">
            Signed in as @{user.username} — your licenses, purchases and financial activity.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/market"
            className="px-3.5 py-2 rounded-md bg-elevated border border-base text-secondary hover:text-primary text-xs font-semibold transition-colors"
          >
            Browse Resources
          </Link>
          <Link
            href="/workspace/licenses"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-accent hover:bg-[var(--nexus-accent-hover)] text-white text-xs font-semibold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New License</span>
          </Link>
        </div>
      </div>

      {/* Dashboard metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Licenses"
          value={activeLicenses.length}
          tone="accent"
          icon={<Key className="w-4 h-4" />}
          context={`${licenses.length} total`}
        />
        <StatCard
          label="Your Sales"
          value={sales.length}
          tone="purple"
          icon={<ShoppingBag className="w-4 h-4" />}
          context="completed orders"
        />
        <StatCard
          label="Ledger Records"
          value={ledger.length}
          icon={<History className="w-4 h-4" />}
          context="recent activity"
        />
        <StatCard
          label="Servers Online"
          value={servers.length}
          tone="success"
          icon={<ServerIcon className="w-4 h-4" />}
          context={`${totalPlayers.toLocaleString()} players`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Licenses */}
        <section>
          <SectionHeader
            title="Your Licenses"
            description="Hardware & IP bound entitlements"
            action={
              <Link href="/workspace/licenses" className="text-xs font-semibold text-accent hover:underline">
                View all
              </Link>
            }
          />
          <div className="space-y-2.5">
            {licenses.length > 0 ? (
              licenses.slice(0, 4).map((lic) => {
                const product = productMap.get(lic.productId);
                return (
                  <div key={lic.id} className="nexus-panel p-3.5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-heading text-primary truncate">
                        {product?.title || "MTA Resource"}
                      </span>
                      <StatusBadge
                        status={lic.status}
                        tone={lic.status === "active" ? "success" : "warning"}
                      />
                    </div>
                    <div className="flex items-center justify-between nexus-inset px-2.5 py-1.5 font-code text-[11px] text-success">
                      <span className="select-all truncate">{lic.key}</span>
                      <span className="font-caption text-faint shrink-0 ml-2">{lic.model}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-8 text-center nexus-panel">
                <p className="font-caption text-muted">No licenses yet.</p>
                <Link href="/market" className="inline-block mt-2 text-xs font-semibold text-accent hover:underline">
                  Explore marketplace
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* Recent Purchases */}
        <section>
          <SectionHeader
            title="Recent Purchases"
            description="Your latest completed orders"
            action={
              <Link href="/workspace/purchases" className="text-xs font-semibold text-accent hover:underline">
                Full history
              </Link>
            }
          />
          <div className="space-y-2.5">
            {sales.length > 0 ? (
              sales.slice(0, 4).map((s) => (
                <div key={`${s.orderId}-${s.productId}`} className="nexus-panel p-3.5 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-xs font-heading text-primary truncate">{s.productTitle}</div>
                    <div className="font-caption text-faint">
                      Order #{s.orderNumber} • {new Date(s.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="font-numeric text-xs font-bold text-success shrink-0">
                    ${(s.unitPrice / 100).toFixed(2)}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center nexus-panel">
                <p className="font-caption text-muted">No purchases yet.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Ledger */}
      <section>
        <SectionHeader
          title="Financial Ledger"
          description="Append-only transaction records"
          action={
            <Link href="/workspace/purchases" className="text-xs font-semibold text-accent hover:underline">
              Purchase history
            </Link>
          }
        />
        <div className="nexus-panel p-4">
          <DataTable>
            <DataTableHeader columns={["Date", "Account", "Description", "Amount"]} />
            <DataTableBody>
              {ledger.length > 0 ? (
                ledger.map((entry) => (
                  <tr key={entry.id}>
                    <td className="py-2.5 pr-4 text-faint">
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </td>
                    <td className="pr-4 text-muted">{entry.accountId}</td>
                    <td className="pr-4 text-secondary">{entry.description}</td>
                    <td className={`text-right font-bold ${entry.amount >= 0 ? "text-success" : "text-muted"}`}>
                      {entry.amount >= 0 ? "+" : ""}${(entry.amount / 100).toFixed(2)}
                    </td>
                  </tr>
                ))
              ) : (
                <DataTableEmpty colSpan={4} message="No ledger transactions recorded yet." />
              )}
            </DataTableBody>
          </DataTable>
        </div>
      </section>
    </div>
  );
}
