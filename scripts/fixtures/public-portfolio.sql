-- Only loaded by the disposable hosted production-browser harness.
INSERT INTO users (id, email, username, display_name, role) VALUES
  ('usr_portfolio_ci', 'portfolio@example.invalid', 'portfolio_ci', 'Portfolio CI Author', 'developer'),
  ('usr_portfolio_other_ci', 'portfolio-other@example.invalid', 'portfolio_other_ci', 'Other author', 'developer');
INSERT INTO organizations (id, name, slug, owner_id) VALUES
  ('org_portfolio_ci', 'Portfolio CI Organization', 'portfolio-ci', 'usr_portfolio_ci'),
  ('org_portfolio_other_ci', 'Other organization', 'portfolio-other-ci', 'usr_portfolio_other_ci');

INSERT INTO products (id, title, slug, description, type, status, author_id, organization_id,
  price, created_at, updated_at)
SELECT 'prd_portfolio_ci_' || lpad(n::text, 3, '0'), 'Portfolio resource ' || lpad(n::text, 3, '0'),
  'portfolio-ci-' || lpad(n::text, 3, '0'), 'Existing portfolio resource.', 'script', 'published',
  'usr_portfolio_ci', 'org_portfolio_ci', 0, '2026-01-01'::timestamptz, '2026-01-01'::timestamptz
FROM generate_series(1, 125) n;
INSERT INTO products (id, title, slug, description, type, status, author_id, organization_id, price)
VALUES
  ('prd_portfolio_draft_ci', 'Hidden draft resource', 'portfolio-hidden-draft', 'Hidden', 'script', 'draft', 'usr_portfolio_ci', 'org_portfolio_ci', 0),
  ('prd_portfolio_paid_ci', 'Hidden paid resource', 'portfolio-hidden-paid', 'Hidden', 'script', 'published', 'usr_portfolio_ci', 'org_portfolio_ci', 100),
  ('prd_portfolio_missing_ci', 'Hidden missing build', 'portfolio-hidden-missing', 'Hidden', 'script', 'published', 'usr_portfolio_ci', 'org_portfolio_ci', 0),
  ('prd_portfolio_rejected_ci', 'Hidden rejected build', 'portfolio-hidden-rejected', 'Hidden', 'script', 'published', 'usr_portfolio_ci', 'org_portfolio_ci', 0),
  ('prd_portfolio_foreign_ci', 'Hidden foreign resource', 'portfolio-hidden-foreign', 'Hidden', 'script', 'published', 'usr_portfolio_other_ci', 'org_portfolio_other_ci', 0);
INSERT INTO builds (id, product_id, version, storage_key, sha256_hash, file_size_bytes,
  status, scan_status, scanner, scanned_at, file_name, mime_type)
SELECT 'bld_' || id, id, '1.0.0', '__STORAGE_KEY__', '__SHA256__', 67108864,
  CASE WHEN id = 'prd_portfolio_rejected_ci' THEN 'rejected' ELSE 'published' END,
  'clean', 'portfolio-ci-fixture', now(), 'portfolio.zip', 'application/zip'
FROM products WHERE id LIKE 'prd_portfolio_%' AND id <> 'prd_portfolio_missing_ci';

INSERT INTO content (id, title, slug, body, type, author_id, organization_id, status, published_at)
SELECT 'cnt_portfolio_ci_' || lpad(n::text, 3, '0'), 'Portfolio article ' || lpad(n::text, 3, '0'),
  'portfolio-article-ci-' || lpad(n::text, 3, '0'), 'Existing editorial publication.', 'article',
  'usr_portfolio_ci', 'org_portfolio_ci', 'published', '2026-01-01'::timestamptz
FROM generate_series(1, 25) n;
INSERT INTO content (id, title, slug, body, type, author_id, organization_id, status) VALUES
  ('cnt_portfolio_draft_ci', 'Hidden draft article', 'portfolio-draft-article-ci', 'Hidden', 'article', 'usr_portfolio_ci', 'org_portfolio_ci', 'draft'),
  ('cnt_portfolio_foreign_ci', 'Hidden foreign article', 'portfolio-foreign-article-ci', 'Hidden', 'article', 'usr_portfolio_other_ci', 'org_portfolio_other_ci', 'published');
