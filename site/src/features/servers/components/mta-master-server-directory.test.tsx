import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getDictionary } from "../../../lib/i18n";
import { applyDirectoryListQuery, parseDirectoryListQuery } from "../directory-list-query";
import { PublicDirectoryOutcome } from "./mta-master-server-directory";

describe("public directory list honesty", () => {
  it.each(["en", "ru"] as const)(
    "uses different sentences for a failed read, an empty directory, and a filter miss in %s",
    (locale) => {
      const copy = getDictionary(locale).servers;
      const unavailable = renderToStaticMarkup(
        createElement(PublicDirectoryOutcome, {
          locale,
          outcome: "unavailable",
          onRetry: () => undefined,
          resetFilters: () => undefined,
        }),
      );
      const empty = renderToStaticMarkup(
        createElement(PublicDirectoryOutcome, {
          locale,
          outcome: "empty",
          onRetry: () => undefined,
          resetFilters: () => undefined,
        }),
      );
      const filtered = renderToStaticMarkup(
        createElement(PublicDirectoryOutcome, {
          locale,
          outcome: "filtered",
          onRetry: () => undefined,
          resetFilters: () => undefined,
        }),
      );

      expect(unavailable).toContain('role="alert"');
      expect(unavailable).toContain(copy.directoryFetchError);
      expect(unavailable).toContain(copy.unavailableHint);
      expect(unavailable).not.toContain(copy.none);
      expect(unavailable).not.toContain(copy.noMatch);

      expect(empty).toContain("border-dashed");
      expect(empty).toContain(copy.none);
      expect(empty).toContain(copy.noneDescription);
      expect(empty).not.toContain(copy.directoryFetchError);
      expect(empty).not.toContain(copy.noMatch);

      expect(filtered).toContain("border-dashed");
      expect(filtered).toContain(copy.noMatch);
      expect(filtered).toContain(copy.noMatchDescription);
      expect(filtered).not.toContain(copy.none);
      expect(filtered).not.toContain(copy.directoryFetchError);

      expect(new Set([copy.directoryFetchError, copy.none, copy.noMatch]).size).toBe(3);
      expect(
        new Set([copy.unavailableHint, copy.noneDescription, copy.noMatchDescription]).size,
      ).toBe(3);
    },
  );

  it("round-trips search, player floor, and page through the URL", () => {
    const search = applyDirectoryListQuery("?tab=keep", {
      query: "  freeroam  ",
      minimumPlayers: 10,
      page: 2,
    });
    expect(search).toContain("tab=keep");
    expect(parseDirectoryListQuery(search)).toEqual({
      query: "freeroam",
      minimumPlayers: 10,
      page: 2,
    });
    expect(applyDirectoryListQuery(search, { query: "", minimumPlayers: 0, page: 0 })).toBe(
      "?tab=keep",
    );
    expect(parseDirectoryListQuery("?q=a&min=3&page=0")).toEqual({
      query: "a",
      minimumPlayers: 0,
      page: 0,
    });
  });
});
