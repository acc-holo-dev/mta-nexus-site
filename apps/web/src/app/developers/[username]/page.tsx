import { notFound } from "next/navigation";
import Link from "next/link";
import { authService } from "../../../lib/services/auth-service";
import { productService } from "../../../lib/services/product-service";
import { ProductCard } from "../../../components/product-card";
import { ShieldCheck, Calendar, Award, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DeveloperProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const users = await authService.listUsers();
  const user = users.find((u) => u.username.toLowerCase() === username.toLowerCase());

  if (!user) {
    notFound();
  }

  const allProducts = await productService.listProducts();
  const authorProducts = allProducts.filter((p) => p.authorId === user.id);

  return (
    <div className="space-y-10">
      {/* Header Profile card */}
      <div className="p-8 rounded-2xl border border-base bg-surface flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-neutral-800 border-2 border-purple-500/50 shadow-xl">
            <img
              src={user.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`}
              alt={user.displayName}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-white">{user.displayName}</h1>
              {user.isVerified && (
                <span title="Verified Member">
                  <ShieldCheck className="w-5 h-5 text-purple-400" />
                </span>
              )}
            </div>
            <div className="text-xs text-neutral-500">@{user.username}</div>
            <p className="text-xs text-neutral-300 max-w-xl">{user.bio}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="px-4 py-2.5 rounded-lg bg-neutral-900 border border-base text-center">
            <div className="text-lg font-bold text-white">{authorProducts.length}</div>
            <div className="text-[10px] text-neutral-500 uppercase tracking-wider">Resources</div>
          </div>
          <div className="px-4 py-2.5 rounded-lg bg-neutral-900 border border-base text-center">
            <div className="text-lg font-bold text-emerald-400">100%</div>
            <div className="text-[10px] text-neutral-500 uppercase tracking-wider">Reputation</div>
          </div>
        </div>
      </div>

      {/* Authored Products */}
      <div className="space-y-6">
        <h2 className="text-lg font-bold text-white">Marketplace Releases by {user.displayName}</h2>
        {authorProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {authorProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <p className="text-xs text-neutral-500">No public releases yet.</p>
        )}
      </div>
    </div>
  );
}
