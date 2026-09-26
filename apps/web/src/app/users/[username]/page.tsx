import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Calendar, ShieldCheck } from "lucide-react";
import { Avatar, StatCard } from "@nexus/ui";
import {
  productRepository,
  serverRepository,
  userRepository,
} from "@nexus/db";
import { ProductCard } from "../../../components/product-card";
import { ServerCard } from "../../../components/server-card";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n-server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const locale = await getRequestLocale();
  const copy = getDictionary(locale).profiles;
  const user = await userRepository.findByUsername(username);

  if (!user) {
    return { title: copy.userNotFound };
  }

  return {
    title: `${user.displayName} (@${user.username})`,
    description:
      user.bio?.slice(0, 155) ||
      `${copy.profileDescription} ${user.displayName}`,
    alternates: { canonical: `/users/${user.username}` },
  };
}

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);
  const copy = dictionary.profiles;
  const user = await userRepository.findByUsername(username);

  if (!user) {
    notFound();
  }

  const [allProducts, allServers] = await Promise.all([
    productRepository.list(),
    serverRepository.listActivePublic(),
  ]);
  const userProducts = allProducts.filter(
    (product) => product.authorId === user.id,
  );
  const userServers = allServers.filter(
    (server) => server.ownerId === user.id,
  );
  const formattedDate = new Date(user.createdAt).toLocaleDateString(
    locale === "ru" ? "ru-RU" : "en-US",
    {
      month: "long",
      year: "numeric",
    },
  );

  return (
    <div className="space-y-10">
      <section className="nexus-panel flex flex-col justify-between gap-6 p-6 shadow-nexus-sm md:flex-row md:items-center md:p-8">
        <div className="flex min-w-0 items-center gap-5 sm:gap-6">
          <Avatar
            src={user.avatarUrl || undefined}
            alt={user.displayName}
            fallback={user.displayName || user.username}
            size="lg"
            className="h-20 w-20 shrink-0 border-2 border-[color:var(--nexus-accent)]/30"
          />
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-black text-primary">
                {user.displayName}
              </h1>
              {user.isVerified && (
                <span title={copy.verifiedMember}>
                  <ShieldCheck
                    className="h-5 w-5 text-success"
                    aria-hidden="true"
                  />
                </span>
              )}
              <span className="rounded border border-base bg-inset px-2 py-0.5 font-numeric text-[10px] font-bold uppercase tracking-wider text-secondary">
                {user.role}
              </span>
            </div>
            <div className="truncate text-xs text-faint">
              @{user.username}
            </div>
            <p className="max-w-xl text-sm leading-relaxed text-muted">
              {user.bio || copy.memberFallback}
            </p>
            <div className="flex items-center gap-1.5 pt-1 text-[11px] text-faint">
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {copy.joined} {formattedDate}
              </span>
            </div>
          </div>
        </div>

        <div className="grid min-w-52 grid-cols-2 gap-3">
          <StatCard
            label={copy.resources}
            value={userProducts.length}
            tone="accent"
          />
          <StatCard
            label={copy.servers}
            value={userServers.length}
            tone="success"
          />
        </div>
      </section>

      {userProducts.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-heading text-primary">
            {copy.authoredResources} ({userProducts.length})
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {userProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                locale={locale}
              />
            ))}
          </div>
        </section>
      )}

      {userServers.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-heading text-primary">
            {copy.operatedServers} ({userServers.length})
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {userServers.map((server) => (
              <ServerCard
                key={server.id}
                server={server}
                locale={locale}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
