import { notFound } from "next/navigation";
import Link from "next/link";
import { userRepository, productRepository, serverRepository } from "@nexus/db";
import { ProductCard } from "../../../components/product-card";
import { ServerCard } from "../../../components/server-card";
import { ShieldCheck, Calendar, User as UserIcon, Building2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const user = await userRepository.findByUsername(username);

  if (!user) {
    notFound();
  }

  const [allProducts, allServers] = await Promise.all([
    productRepository.list(),
    serverRepository.listActivePublic(),
  ]);

  const userProducts = allProducts.filter((p) => p.authorId === user.id);
  const userServers = allServers.filter((s) => s.ownerId === user.id);

  const formattedDate = new Date(user.createdAt).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-10">
      {/* Profile Header */}
      <div className="p-8 rounded-2xl border border-[#232838] bg-[#11131a] flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-neutral-800 border-2 border-blue-500/50 shadow-xl shrink-0">
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
                  <ShieldCheck className="w-5 h-5 text-blue-400" />
                </span>
              )}
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-neutral-800 text-neutral-300">
                {user.role}
              </span>
            </div>
            <div className="text-xs text-neutral-500">@{user.username}</div>
            <p className="text-xs text-neutral-300 max-w-xl">
              {user.bio || "MTA Community member and platform explorer."}
            </p>
            <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 pt-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>Joined {formattedDate}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="px-4 py-2.5 rounded-lg bg-neutral-900 border border-[#232838] text-center min-w-24">
            <div className="text-lg font-bold text-white">{userProducts.length}</div>
            <div className="text-[10px] text-neutral-500 uppercase tracking-wider">Resources</div>
          </div>
          <div className="px-4 py-2.5 rounded-lg bg-neutral-900 border border-[#232838] text-center min-w-24">
            <div className="text-lg font-bold text-emerald-400">{userServers.length}</div>
            <div className="text-[10px] text-neutral-500 uppercase tracking-wider">Servers</div>
          </div>
        </div>
      </div>

      {/* Authored Resources */}
      {userProducts.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-base font-bold text-white uppercase tracking-wider">
            Authored Resources ({userProducts.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {userProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* Operated Servers */}
      {userServers.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-base font-bold text-white uppercase tracking-wider">
            Operated Servers ({userServers.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {userServers.map((s) => (
              <ServerCard key={s.id} server={s} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
