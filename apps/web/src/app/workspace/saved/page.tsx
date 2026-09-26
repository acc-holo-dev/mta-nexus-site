import Link from "next/link";
import { cookies } from "next/headers";
import {
  productRepository,
  serverRepository,
  socialRepository,
} from "@nexus/db";
import { ArrowLeft, Bookmark, Compass } from "lucide-react";
import { EmptyState } from "@nexus/ui";
import { authService } from "../../../lib/services/auth-service";
import { ProductCard } from "../../../components/product-card";
import { ServerCard } from "../../../components/server-card";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);
  const copy = dictionary.savedPage;

  const token = (await cookies()).get("nexus_session")?.value;
  const user = await authService.getSession(token);

  if (!user) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-20 text-center">
        <Bookmark className="mx-auto h-9 w-9 text-accent" aria-hidden="true" />
        <h1 className="font-display text-primary">{copy.signInRequired}</h1>
        <p className="font-caption text-muted">{copy.signInMessage}</p>
        <Link
          href="/auth/login"
          className="inline-block rounded-md bg-accent px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--nexus-accent-hover)]"
        >
          {copy.signIn}
        </Link>
      </div>
    );
  }

  const [follows, products, servers] = await Promise.all([
    socialRepository.listFollows(user.id),
    productRepository.list(),
    serverRepository.listActivePublic(),
  ]);

  const savedProductIds = new Set(
    follows
      .filter((follow) => follow.targetType === "product")
      .map((follow) => follow.targetId),
  );
  const savedServerIds = new Set(
    follows
      .filter((follow) => follow.targetType === "server")
      .map((follow) => follow.targetId),
  );

  const savedProducts = products.filter((product) =>
    savedProductIds.has(product.id),
  );
  const savedServers = servers.filter((server) =>
    savedServerIds.has(server.id),
  );

  return (
    <div className="space-y-8">
      <header className="border-b border-base pb-6">
        <div className="mb-2 flex items-center gap-2 text-xs text-muted">
          <Link
            href="/workspace"
            className="flex items-center gap-1 transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-3 w-3" aria-hidden="true" />
            <span>{copy.workspace}</span>
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-secondary">{copy.breadcrumb}</span>
        </div>
        <h1 className="flex items-center gap-2.5 font-display text-primary">
          <Bookmark className="h-6 w-6 text-purple" aria-hidden="true" />
          <span>{copy.title}</span>
        </h1>
        <p className="mt-1 max-w-2xl font-caption text-muted">
          {copy.description}
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="font-label uppercase text-muted">
          {copy.resources} ({savedProducts.length})
        </h2>
        {savedProducts.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {savedProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                locale={locale}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title={copy.noResources}
            description={dictionary.market.empty}
            icon={<Bookmark className="h-6 w-6" />}
          />
        )}
      </section>

      <section className="space-y-4">
        <h2 className="font-label uppercase text-muted">
          {copy.servers} ({savedServers.length})
        </h2>
        {savedServers.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {savedServers.map((server) => (
              <ServerCard
                key={server.id}
                server={server}
                locale={locale}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title={copy.noServers}
            description={dictionary.servers.description}
            icon={<Compass className="h-6 w-6" />}
            action={
              <Link
                href="/servers"
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white"
              >
                <Compass className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{copy.discoverServers}</span>
              </Link>
            }
          />
        )}
      </section>
    </div>
  );
}
