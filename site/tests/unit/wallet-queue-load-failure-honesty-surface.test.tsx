import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

/** Honesty lock: wallet queue load failures use ErrorState+retry, not muted empty-looking copy. */
it("locks wallet workspace and providers-admin queue load failures to ErrorState", () => {
  const workspace = read("site/src/features/commerce/server/wallet-workspace-screen.tsx");
  expect(workspace).toContain("listManageableOrganizationSellerAccounts(user).catch(() => null)");
  expect(workspace).not.toContain("listManageableOrganizationSellerAccounts(user).catch(() => [])");
  expect(workspace).toContain("title={copy.heldUnavailable}");
  expect(workspace).toContain("title={copy.activityUnavailable}");
  expect(workspace).toContain("title={copy.historyUnavailable}");
  expect(workspace).toContain("title={copy.orgTopUpsUnavailable}");
  expect(workspace).toContain("title={copy.orgActivityUnavailable}");
  expect(workspace).toContain("title={copy.withdrawalsUnavailable}");
  expect(workspace).toContain("dictionary.errors.retry");
  expect(workspace).toMatch(
    /heldBalance === null \|\| heldList === null \? \(\s*<ErrorState[\s\S]*?title=\{copy\.heldUnavailable\}/u,
  );
  expect(workspace).toMatch(
    /activity === null \? \(\s*<ErrorState[\s\S]*?title=\{copy\.activityUnavailable\}/u,
  );
  expect(workspace).toMatch(
    /history === null \? \(\s*<ErrorState[\s\S]*?title=\{copy\.historyUnavailable\}/u,
  );
  expect(workspace).not.toMatch(
    /<p className=\{typeXsMuted\}>\{copy\.(held|activity|history)Unavailable\}<\/p>/u,
  );
  expect(workspace).not.toMatch(
    /<p className=\{typeXsMuted\}>\{copy\.(orgTopUps|orgActivity|withdrawals)Unavailable\}<\/p>/u,
  );
  expect(workspace).toContain("EmptyState title={copy.heldEmpty}");
  expect(workspace).toContain("EmptyState title={copy.activityEmpty}");
  expect(workspace).toContain("EmptyState title={copy.historyEmpty}");

  const providers = read("site/src/features/commerce/server/wallet-providers-admin-screen.tsx");
  expect(providers).toContain('import { ErrorState } from "@nexus/ui"');
  expect(providers).toContain("dictionary.errors.retry");
  expect(providers).toContain("title={copy.providersAdminHoldsPreviewUnavailable}");
  expect(providers).toContain("title={copy.providersAdminTopupPreviewUnavailable}");
  expect(providers).toContain("title={copy.providersAdminUnpaidPreviewUnavailable}");
  expect(providers).toContain("title={copy.providersAdminWithdrawPreviewUnavailable}");
  expect(providers).toContain("title={copy.providersAdminIntentsUnavailable}");
  expect(providers).toMatch(
    /eligibleHolds === null \? \(\s*<ErrorState[\s\S]*?providersAdminHoldsPreviewUnavailable/u,
  );
  expect(providers).toMatch(
    /intentsUnavailable \? \(\s*<ErrorState[\s\S]*?providersAdminIntentsUnavailable/u,
  );
  expect(providers).not.toMatch(
    /eligibleHolds === null \? \(\s*<p role="note" className=\{typeSmMuted\}>/u,
  );
  expect(providers).not.toMatch(
    /intentsUnavailable \? \(\s*<p role="note" className=\{typeSmMuted\}>/u,
  );
  expect(providers).toContain("{copy.providersAdminHoldsPreviewEmpty}");
  expect(providers).toContain("{copy.providersAdminTopupsEmpty}");
});
