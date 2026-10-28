import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { expect, it, vi } from "vitest";

const active = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("../packages/db/src/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("../packages/db/src/client")>();
  return {
    ...original,
    db: new Proxy(original.db, {
      get(target, key) {
        const database = (active.db ?? target) as typeof target;
        const value = Reflect.get(database, key);
        return typeof value === "function" ? value.bind(database) : value;
      },
    }),
  };
});
import { ProductRepository } from "../packages/db/src/repositories/products";
import { ContentRepository } from "../packages/db/src/repositories/content";

it("executes deep scoped portfolios on PostgreSQL and measures plans before/after additive indexes", async () => {
  const { db } = await vi.importActual<typeof import("../packages/db/src/client")>(
    "../packages/db/src/client",
  );
  await db.transaction(async (tx) => {
    active.db = tx;
    try {
      for (const table of ["products", "builds", "content"]) {
        await tx.execute(
          sql.raw(
            `CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING DEFAULTS INCLUDING CONSTRAINTS) ON COMMIT DROP`,
          ),
        );
      }
      await tx.execute(sql`CREATE INDEX perf_old_author ON products(author_id)`);
      await tx.execute(sql`CREATE INDEX perf_old_build_product ON builds(product_id, status)`);
      await tx.execute(sql`INSERT INTO products (id, title, slug, description, type, status, author_id, organization_id, price, created_at)
        SELECT 'perf_' || lpad(n::text, 5, '0'), 'Resource ' || n, 'perf-' || n, 'Performance fixture', 'script', 'published',
          CASE WHEN n <= 125 THEN 'target-author' ELSE 'background-' || (n % 100) END,
          CASE WHEN n <= 125 THEN 'target-org' ELSE 'background-' || (n % 100) END,
          0, '2026-01-01'::timestamptz FROM generate_series(1, 10125) n`);
      await tx.execute(sql`INSERT INTO products (id, title, slug, description, type, status, author_id, organization_id, price)
        VALUES ('perf_draft', 'Hidden', 'perf-draft', 'Hidden', 'script', 'draft', 'target-author', 'target-org', 0),
          ('perf_paid', 'Hidden', 'perf-paid', 'Hidden', 'script', 'published', 'target-author', 'target-org', 100),
          ('perf_missing', 'Hidden', 'perf-missing', 'Hidden', 'script', 'published', 'target-author', 'target-org', 0)`);
      await tx.execute(sql`INSERT INTO builds (id, product_id, version, storage_key, sha256_hash, file_size_bytes, status, scan_status, scanner, scanned_at)
        SELECT 'build_' || id, id, '1.0.0', 'fixture/' || id || '.zip', repeat('a', 64), 16,
          'published', 'clean', 'fixture', now() FROM products WHERE id <> 'perf_missing'`);
      await tx.execute(sql`INSERT INTO content (id, title, slug, body, type, status, author_id, organization_id, published_at)
        SELECT 'article_' || lpad(n::text, 5, '0'), 'Article ' || n, 'perf-article-' || n, 'Performance fixture',
          'article', 'published', 'target-author', CASE WHEN n <= 25 THEN 'target-org' ELSE 'background-' || (n % 100) END,
          '2026-01-01'::timestamptz FROM generate_series(1, 10025) n`);
      for (const table of ["products", "builds", "content"])
        await tx.execute(sql.raw(`ANALYZE ${table}`));
      const safe =
        "EXISTS (SELECT 1 FROM builds b WHERE b.product_id = p.id AND b.status = 'published' AND b.scan_status = 'clean' AND b.scanner IS NOT NULL AND btrim(b.scanner) <> '' AND b.scanned_at IS NOT NULL)";
      // Representative SQL matches the real repositories' scope, filters and ordering;
      // repository return values below are also executed, without a query-layer mock.
      const queries = {
        authorPage: `SELECT p.* FROM products p WHERE author_id = 'target-author' AND status = 'published' AND price = 0 AND ${safe} ORDER BY created_at DESC, id DESC LIMIT 24 OFFSET 96`,
        organizationPage: `SELECT p.* FROM products p WHERE organization_id = 'target-org' AND status = 'published' AND price = 0 AND ${safe} ORDER BY created_at DESC, id DESC LIMIT 24 OFFSET 96`,
        organizationCount: `SELECT count(*) FROM products p WHERE organization_id = 'target-org' AND status = 'published' AND price = 0 AND ${safe}`,
        articlePage:
          "SELECT * FROM content WHERE organization_id = 'target-org' AND status = 'published' AND type IN ('article', 'news', 'devlog', 'update', 'announcement') ORDER BY coalesce(published_at, updated_at) DESC, id DESC LIMIT 12 OFFSET 12",
      };
      const plans = async () => {
        const result: Record<string, unknown> = {};
        for (const [name, query] of Object.entries(queries)) {
          const rows = await tx.execute(
            sql.raw(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`),
          );
          result[name] = rows[0]["QUERY PLAN"];
        }
        return result;
      };
      const before = await plans();
      await tx.execute(
        sql.raw(readFileSync("packages/db/migrations/0026_public_portfolio_indexes.sql", "utf8")),
      );
      const after = await plans();
      expect(JSON.stringify(after.organizationPage)).toContain(
        "products_public_org_created_id_idx",
      );
      expect(JSON.stringify(after.articlePage)).toContain("content_public_org_published_id_idx");
      const products = new ProductRepository();
      const author = await products.pagePublishedFreeByAuthor("target-author", 5);
      const organization = await products.pagePublishedFreeByOrganization("target-org", 5);
      const expected = Array.from(
        { length: 24 },
        (_, n) => `perf_${String(29 - n).padStart(5, "0")}`,
      );
      expect(author).toMatchObject({ total: 125, page: 5, totalPages: 6 });
      expect(author.products.map((row) => row.id)).toEqual(expected);
      expect(organization.products.map((row) => row.id)).toEqual(expected);
      expect(
        (await products.pagePublishedFreeByOrganization("target-org", 999)).products.map(
          (row) => row.id,
        ),
      ).toEqual([5, 4, 3, 2, 1].map((n) => `perf_${String(n).padStart(5, "0")}`));
      const articles = await new ContentRepository().pagePublishedEditorialByOrganization(
        "target-org",
        3,
      );
      expect(articles).toMatchObject({ total: 25, page: 3, totalPages: 3 });
      expect(articles.items.map((row) => row.id)).toEqual(["article_00001"]);
      if (process.env.GITHUB_ACTIONS === "true") {
        mkdirSync("artifacts", { recursive: true });
        writeFileSync(
          "artifacts/portfolio-query-plans.json",
          JSON.stringify(
            {
              sha: process.env.GITHUB_SHA,
              status: "PASS",
              resources: 10128,
              builds: 10127,
              articles: 10025,
              before,
              after,
              limitations:
                "Synthetic PostgreSQL fixture, warm cache and representative SQL. No timing SLA or production-data claim.",
            },
            null,
            2,
          ),
        );
      }
    } finally {
      active.db = null;
    }
  });
}, 30_000);
