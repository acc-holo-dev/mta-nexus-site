import Link from "next/link";
import { licenseRepository, productRepository } from "@nexus/db";
import { Key, ArrowLeft, Download, ShieldCheck, Server } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function LicensesPage() {
  const licenses = await licenseRepository.listAll();
  const products = await productRepository.list();
  const productMap = new Map(products.map((p) => [p.id, p]));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-base pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-neutral-400 mb-2">
            <Link href="/workspace" className="hover:text-white flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" />
              <span>Workspace</span>
            </Link>
            <span>/</span>
            <span className="text-neutral-200">Licenses</span>
          </div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <Key className="w-6 h-6 text-blue-500" />
            <span>Cryptographic Licenses</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Manage your hardware and server IP bound resource entitlements.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {licenses.length > 0 ? (
          licenses.map((lic) => {
            const product = productMap.get(lic.productId);
            return (
              <div
                key={lic.id}
                className="p-5 rounded-xl border border-base bg-surface space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800 pb-3">
                  <div>
                    <h3 className="font-bold text-sm text-white">
                      {product?.title || "MTA Resource"}
                    </h3>
                    <div className="text-xs text-neutral-500 capitalize">
                      Model: {lic.model.replace(/_/g, " ")} вЂў Status: {lic.status}
                    </div>
                  </div>
                  <span className="self-start sm:self-auto px-2.5 py-1 rounded text-xs font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {lic.status.toUpperCase()}
                  </span>
                </div>

                {/* Key box */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                    Activation License Key
                  </span>
                  <div className="flex items-center justify-between font-mono text-xs text-emerald-400 bg-neutral-900 p-3 rounded-lg border border-neutral-800 select-all">
                    <span>{lic.key}</span>
                    <span className="text-[11px] text-neutral-500 font-sans">Hardware Bound</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs text-neutral-400">
                  <div className="flex items-center gap-2">
                    <Server className="w-3.5 h-3.5 text-neutral-500" />
                    <span>Server: {lic.serverId || "Unbound (Floating Seat)"}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    {product && (
                      <Link
                        href={`/market/${product.slug}`}
                        className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-base transition-colors"
                      >
                        Product Page
                      </Link>
                    )}
                    <a
                      href={`/api/products/${lic.productId}/download`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Build</span>
                    </a>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-16 text-center rounded-xl border border-dashed border-base bg-surface/40">
            <p className="text-sm text-neutral-400">No active licenses found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
