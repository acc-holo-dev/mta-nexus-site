import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getDictionary } from "../apps/web/src/lib/i18n";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("closed-beta workspace surfaces", () => {
  it("keeps saved items private and locale-aware", () => {
    const page = read("apps/web/src/app/workspace/saved/page.tsx");

    expect(page).toContain("authService.getSession(token)");
    expect(page).toContain("socialRepository.listFollows(user.id)");
    expect(page).toContain("productRepository.list()");
    expect(page).toContain("serverRepository.listActivePublic()");
    expect(page).toContain("locale={locale}");
    expect(page).toContain("dictionary.savedPage");

    const en = getDictionary("en").savedPage;
    const ru = getDictionary("ru").savedPage;
    expect(en.title).not.toBe(ru.title);
    expect(en.noServers).not.toBe(ru.noServers);
  });

  it("keeps legacy commerce routes disabled in closed beta", () => {
    for (const path of [
      "apps/web/src/app/workspace/licenses/page.tsx",
      "apps/web/src/app/workspace/purchases/page.tsx",
      "apps/web/src/app/workspace/sales/page.tsx",
    ]) {
      const source = read(path);
      expect(source).toContain('redirect("/workspace")');
      expect(source).not.toContain("checkout");
      expect(source).not.toContain("payment");
    }
  });
});
