import { sql } from "drizzle-orm";
import { builds, products, servers } from "../schema";
import { safePublishedBuildCondition } from "./build-safety";

/** Public projections must not expose identifiers of hidden associated objects. */
export function publicContentAssociations() {
  return {
    serverId: sql<string | null>`case when exists (
      select 1 from ${servers} where ${servers.id} = content.server_id
        and ${servers.visibility} = 'public' and ${servers.status} = 'active'
    ) then content.server_id else null end`,
    productId: sql<string | null>`case when exists (
      select 1 from ${products} where ${products.id} = content.product_id
        and ${products.status} = 'published' and ${products.price} = 0
        and exists (select 1 from ${builds} where ${safePublishedBuildCondition(sql`${products.id}`)})
    ) then content.product_id else null end`,
  };
}
