import { store } from "../../lib/services/store";
import { commerceService } from "../../lib/services/commerce-service";
import Link from "next/link";
import {
  Key,
  Server,
  Download,
  DollarSign,
  Plus,
  Box,
  Layers,
  History,
  ShieldCheck,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function WorkspacePage() {
  const licenses = Array.from(store.licenses.values());
  const servers = Array.from(store.servers.values());
  const products = Array.from(store.products.values());
  const ledger = [...store.ledgerEntries].reverse().slice(0, 10);

  return (
    <div className="space-y-10">
      {/* Workspace Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#232838] pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Workspace & Assets</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Manage your acquired licenses, server module installations, releases, and transaction ledger.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/market"
            className="px-3.5 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-xs font-semibold text-neutral-200 border border-[#232838] transition-colors"
          >
            Browse Resources
          </Link>
          <button className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white transition-colors">
            + New Build
          </button>
        </div>
      </div>

      {/* Grid of Key Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Active Licenses */}
        <div className="p-6 rounded-xl border border-[#232838] bg-[#11131a] space-y-4">
          <div className="flex items-center justify-between border-b border-[#232838] pb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-blue-400" />
              <span>Cryptographic Licenses ({licenses.length})</span>
            </h2>
            <span className="text-[11px] text-neutral-500">Hardware & IP verified</span>
          </div>

          <div className="space-y-3">
            {licenses.map((lic) => {
              const product = store.products.get(lic.productId);
              return (
                <div
                  key={lic.id}
                  className="p-3.5 rounded-lg bg-neutral-900 border border-[#232838] space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">
                      {product?.title || "MTA Resource"}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      {lic.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between font-mono text-xs text-neutral-300 bg-black/50 p-2 rounded border border-neutral-800">
                    <span className="select-all">{lic.key}</span>
                    <button className="text-[11px] text-blue-400 hover:underline">Copy</button>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-1">
                    <span>Model: {lic.model}</span>
                    <span>Server: {lic.serverId || "Unbound (Floating)"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Registered Servers */}
        <div className="p-6 rounded-xl border border-[#232838] bg-[#11131a] space-y-4">
          <div className="flex items-center justify-between border-b border-[#232838] pb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-400" />
              <span>Registered Servers ({servers.length})</span>
            </h2>
            <Link href="/servers" className="text-xs text-emerald-400 hover:underline">
              Add Server
            </Link>
          </div>

          <div className="space-y-3">
            {servers.map((s) => (
              <div
                key={s.id}
                className="p-3.5 rounded-lg bg-neutral-900 border border-[#232838] flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-bold text-white">{s.name}</div>
                  <div className="text-[11px] text-neutral-500 font-mono">
                    {s.ipAddress}:{s.port}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-emerald-400">
                    {s.currentPlayers} / {s.maxPlayers}
                  </div>
                  <div className="text-[10px] text-neutral-500">Live Players</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Financial Ledger Section */}
      <div className="p-6 rounded-xl border border-[#232838] bg-[#11131a] space-y-4">
        <div className="flex items-center justify-between border-b border-[#232838] pb-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <History className="w-4 h-4 text-amber-400" />
            <span>Immutable Financial Ledger Audit</span>
          </h2>
          <span className="text-[11px] text-neutral-500">Append-Only Transactions</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] text-neutral-500 uppercase border-b border-neutral-800">
              <tr>
                <th className="py-2.5">Date</th>
                <th>Account</th>
                <th>Description</th>
                <th>Reference</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60 font-mono text-neutral-300">
              {ledger.map((entry) => (
                <tr key={entry.id}>
                  <td className="py-2.5 text-neutral-500">
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </td>
                  <td className="text-neutral-400">{entry.accountId}</td>
                  <td>{entry.description}</td>
                  <td className="text-neutral-500">{entry.referenceId}</td>
                  <td
                    className={`text-right font-bold ${
                      entry.amount >= 0 ? "text-emerald-400" : "text-neutral-400"
                    }`}
                  >
                    {entry.amount >= 0 ? "+" : ""}${(entry.amount / 100).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
