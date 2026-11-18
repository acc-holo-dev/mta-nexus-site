import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

it("locks follow initial state to authenticated=null on session probe failure", () => {
  const state = read("site/src/features/community/follow-initial-state.ts");
  expect(state).toContain("authenticated: boolean | null");
  expect(state).toContain("`null` = session probe failed (not a guest).");
  expect(state).toContain("authenticated: null");
  expect(state).not.toMatch(
    /actor === undefined\) \{\s*return \{ authenticated: false, actorId: null, following: false, error: true \};/u,
  );
});

it("locks FollowButton and content follow controls away from guest CTAs on null auth", () => {
  const button = read("site/src/features/community/components/follow-button.tsx");
  const controls = read("site/src/features/community/components/content-follow-controls.tsx");
  expect(button).toContain("authenticated: boolean | null");
  expect(button).toContain("initial.authenticated === null || initial.error");
  expect(controls).toContain("authenticated: boolean | null");
  expect(controls).toContain("initial?.authenticated === null");
  expect(controls).toContain("if (authenticated === null)");
});

it("locks article sessionFailed follow seed to authenticated=null", () => {
  const page = read("site/src/features/community/server/article-page.tsx");
  expect(page).toMatch(/sessionFailed\s*\?\s*\{\s*authenticated:\s*null,/u);
});
