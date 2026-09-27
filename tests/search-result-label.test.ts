import { describe, expect, it } from "vitest";
import { searchResultLabel } from "../apps/web/src/lib/search-result-label";
import type { SearchResultItem } from "../apps/web/src/lib/services/discovery-service";

const item = (type: SearchResultItem["type"], extras: Partial<SearchResultItem> = {}): SearchResultItem => ({
  id: "test", type, title: "Test", description: "Test", url: "/test", ...extras,
});

describe("bilingual search result labels", () => {
  it("labels free resources without a misleading price", () => {
    expect(searchResultLabel(item("product"), "en")).toBe("Free");
    expect(searchResultLabel(item("product"), "ru")).toBe("Бесплатно");
  });

  it("uses fresh numeric observations and a neutral fallback when counts are absent", () => {
    expect(searchResultLabel(item("server", { players: 0, maxPlayers: 32 }), "en")).toBe("0/32 players");
    expect(searchResultLabel(item("server", { players: 7, maxPlayers: 32 }), "ru")).toBe("7/32 игроков");
    expect(searchResultLabel(item("server"), "ru")).toBe("Сервер MTA");
  });

  it("localizes article, developer and verified studio categories", () => {
    expect(searchResultLabel(item("article"), "ru")).toBe("Статья");
    expect(searchResultLabel(item("developer"), "ru")).toBe("Разработчик");
    expect(searchResultLabel(item("organization", { verified: true }), "ru")).toBe("Проверенная организация");
    expect(searchResultLabel(item("organization"), "ru")).toBe("Студия");
  });
});
