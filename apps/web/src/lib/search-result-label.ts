import { getDictionary, type Locale } from "./i18n";
import type { SearchResultItem } from "./services/discovery-service";

export function searchResultLabel(item: SearchResultItem, locale: Locale): string {
  const dictionary = getDictionary(locale);
  if (item.type === "product") return dictionary.product.free;
  if (item.type === "server") {
    return item.players === undefined
      ? dictionary.serverDetail.serverFallback
      : `${item.players}/${item.maxPlayers ?? "?"} ${dictionary.servers.players}`;
  }
  if (item.type === "article") return dictionary.commandPalette.articleResult;
  if (item.type === "developer") return dictionary.commandPalette.developerResult;
  return item.verified
    ? dictionary.organizations.verified
    : dictionary.commandPalette.organizationResult;
}
