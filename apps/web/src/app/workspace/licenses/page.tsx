import Link from "next/link";
import { cookies } from "next/headers";
import { licenseRepository, productRepository } from "@nexus/db";
import { authService } from "../../../lib/services/auth-service";
import { StatusBadge } from "@nexus/ui";
import { Key, ArrowLeft, Download, Server as ServerIcon } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function LicensesPage() {
  // Session isolation: a user only sees their own licenses (PLAN-003 TASK-013)
  const cookieStore = await cookies();
  const token = cookieStore.get("nexus_session")?.value;
  const user = await authService.getSession(token);

  if (!user) {
    return (
      <div className="max-w-md mx-auto py-20 text-center space-y-4">
        <h1 className="font-display text-primary">Sign in required</h1>
        <p className="font-caption text-muted">
          Licenses are private entitlements. Sign in to manage yours.
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

  const licenses = await licenseRepository.listByUser(user.id);
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
            <span className="text-secondary">Licenses</span>
          </div>
          <h1 className="font-display text-primary flex items-center gap-2.5">
            <Key className="w-6 h-6 text-accent" />
            <span>Your Licenses</span>
          </h1>
          <p className="font-caption text-muted mt-1">
            Hardware and server bound resource entitlements.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {licenses.length > 0 ? (
          licenses.map((lic) => {
            const product = productMap.get(lic.productId);
            return (
              <div key={lic.id} className="nexus-panel p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-base pb-3">
                  <div>
                    <h3 className="font-heading text-sm text-primary">
                      {product?.title || "MTA Resource"}
                    </h3>
                    <div className="font-caption text-muted capitalize">
                      Model: {lic.model.replace(/_/g, " ")}
                    </div>
                  </div>
                  <StatusBadge
                    status={lic.status}
                    tone={lic.status === "active" ? "success" : "warning"}
                  />
                </div>

                {/* Key box */}
                <div className="space-y-1.5">
                  <span className="font-label text-muted uppercase">Activation Key</span>
                  <div className="flex items-center justify-between font-code text-xs text-success nexus-inset p-3">
                    <span className="select-all">{lic.key}</span>
                    <span className="font-caption text-faint">Hardware Bound</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted">
                  <div className="flex items-center gap-2">
                    <ServerIcon className="w-3.5 h-3.5" />
                    <span>Server: {lic.serverId || "Unbound (Floating Seat)"}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    {product && (
                      <Link
                        href={`/market/${product.slug}`}
                        className="px-3 py-1.5 rounded-md bg-elevated hover:bg-hover text-secondary border border-base transition-colors"
                      >
                        Product Page
                      </Link>
                    )}
                    <a
                      href={`/api/products/${lic.productId}/download`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent hover:bg-[var(--nexus-accent-hover)] text-white font-semibold shadow-nexus-sm transition-colors"
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
          <div className="py-16 text-center nexus-panel">
            <p className="font-caption text-muted">No active licenses found.</p>
            <Link
              href="/market"
              className="inline-block mt-3 px-4 py-2 rounded-md bg-accent hover:bg-[var(--nexus-accent-hover)] text-white text-xs font-semibold transition-colors"
            >
              Browse Marketplace
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
