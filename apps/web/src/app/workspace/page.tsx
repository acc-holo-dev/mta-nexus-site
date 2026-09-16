import Link from "next/link";
import {
  licenseRepository,
  serverRepository,
  productRepository,
  ledgerRepository,
} from "@nexus/db";
import { StatCard, SectionHeader, DataTable, DataTableHeader, DataTableBody, DataTableEmpty, StatusBadge } from "@nexus/ui";
import {
  Key,
  Server as ServerIcon,
  History,
  Plus,
  DollarSign,
  Users,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function WorkspacePage() {
  const [licenses, servers, products, ledger] = await Promise.all([
    licenseRepository.listAll(),
    serverRepository.listActivePublic(),
    productRepository.list(),
    ledgerRepository.listRecent(10),
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
            Your licenses, servers, purchases and financial activity in one place.
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

      {/* Dashboard metrics (TASK-018 unified StatCard format) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Licenses"
          value={activeLicenses.length}
          tone="accent"
          icon={<Key className="w-4 h-4" />}
          context={`${licenses.length} total`}
        />
        <StatCard
          label="Servers"
          value={servers.length}
          tone="success"
          icon={<ServerIcon className="w-4 h-4" />}
          context={`${totalPlayers.toLocaleString()} players online`}
        />
        <StatCard
          label="Ledger Records"
          value={ledger.length}
          icon={<History className="w-4 h-4" />}
          context="recent activity"
        />
        <StatCard
          label="Sales"
          value={ledger.filter((e) => e.amount > 0).length}
          tone="purple"
          icon={<DollarSign className="w-4 h-4" />}
          context="credit entries"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Licenses */}
        <section>
          <SectionHeader
            title="Licenses"
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
                      <StatusBadge status={lic.status} tone={lic.status === "active" ? "success" : "warning"} />
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

        {/* Servers */}
        <section>
          <SectionHeader
            title="Servers"
            description="Live telemetry from your servers"
            action={
              <Link href="/servers" className="text-xs font-semibold text-accent hover:underline">
                Directory
              </Link>
            }
          />
          <div className="space-y-2.5">
            {servers.length > 0 ? (
              servers.slice(0, 4).map((s) => (
                <Link
                  key={s.id}
                  href={`/servers/${s.slug}`}
                  className="nexus-panel p-3.5 flex items-center justify-between hover:border-strong transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-heading text-primary truncate">{s.name}</div>
                    <div className="font-code text-[11px] text-muted">
                      {s.ipAddress}:{s.port}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-numeric text-xs font-bold text-success">
                      {s.currentPlayers} / {s.maxPlayers}
                    </div>
                    <div className="font-caption text-faint flex items-center gap-1 justify-end">
                      <Users className="w-3 h-3" />
                      online
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="py-8 text-center nexus-panel">
                <p className="font-caption text-muted">No servers registered.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Ledger (unified DataTable — TASK-019) */}
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
