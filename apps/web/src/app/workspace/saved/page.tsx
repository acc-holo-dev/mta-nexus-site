import Link from "next/link";
import { cookies } from "next/headers";
import { socialRepository, productRepository, serverRepository } from "@nexus/db";
import { authService } from "../../../lib/services/auth-service";
import { ProductCard } from "../../../components/product-card";
import { ServerCard } from "../../../components/server-card";
import { Bookmark, ArrowLeft, Compass } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SavedPage() {
  // Session isolation: real saved targets (follows) for the current user
  const cookieStore = await cookies();
  const token = cookieStore.get("nexus_session")?.value;
  const user = await authService.getSession(token);

  if (!user) {
    return (
      <div className="max-w-md mx-auto py-20 text-center space-y-4">
        <h1 className="font-display text-primary">Sign in required</h1>
        <p className="font-caption text-muted">
          Your saved items are private. Sign in to view them.
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

  const follows = await socialRepository.listFollows(user.id, undefined, 100);

  const savedProductIds = new Set(
    follows.filter((f) => f.targetType === "product").map((f) => f.targetId)
  );
  const savedServerIds = new Set(
    follows.filter((f) => f.targetType === "server").map((f) => f.targetId)
  );

  const [savedProducts, savedServers] = await Promise.all([
    productRepository.listPublishedFreeByIds([...savedProductIds]),
    serverRepository.listActiveVisibleByIds([...savedServerIds]),
  ]);

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
            <span className="text-secondary">Saved</span>
          </div>
          <h1 className="font-display text-primary flex items-center gap-2.5">
            <Bookmark className="w-6 h-6 text-purple" />
            <span>Saved Items</span>
          </h1>
          <p className="font-caption text-muted mt-1">
            Your saved public servers and eligible free resources appear here.
          </p>
          {follows.length === 100 && (
            <p className="font-caption text-muted mt-1">Showing your 100 most recent saved items.</p>
          )}
        </div>
      </div>

      {/* Saved Products */}
      <section className="space-y-4">
        <h2 className="font-label text-muted uppercase">
          Saved Resources ({savedProducts.length})
        </h2>
        {savedProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {savedProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <div className="py-10 text-center nexus-panel">
            <p className="font-caption text-muted">No saved resources yet.</p>
          </div>
        )}
      </section>

      {/* Saved Servers */}
      <section className="space-y-4">
        <h2 className="font-label text-muted uppercase">Saved Servers ({savedServers.length})</h2>
        {savedServers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {savedServers.map((s) => (
              <ServerCard key={s.id} server={s} />
            ))}
          </div>
        ) : (
          <div className="py-10 text-center nexus-panel">
            <p className="font-caption text-muted">No saved servers yet.</p>
            <Link
              href="/servers"
              className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold text-accent hover:underline"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Discover servers</span>
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
