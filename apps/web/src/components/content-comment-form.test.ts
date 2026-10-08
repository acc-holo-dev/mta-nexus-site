import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "../lib/i18n";

const state = vi.hoisted(() => ({
  locale: "en" as "en" | "ru",
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("./locale-context", () => ({
  useNexusLocale: () => ({
    locale: state.locale,
    dictionary: getDictionary(state.locale),
  }),
}));

import { ContentCommentForm } from "./content-comment-form";
import { submitContentCommentRequest } from "../lib/content-comment-client";

describe("content discussion form", () => {
  beforeEach(() => {
    state.locale = "en";
  });

  it.each(["en", "ru"] as const)(
    "renders the localized protected comment form in %s",
    (locale) => {
      state.locale = locale;
      const html = renderToStaticMarkup(
        createElement(ContentCommentForm, { slug: "hello world/one" }),
      );
      const copy = getDictionary(locale).articles;
      expect(html).toContain(copy.joinDiscussion);
      expect(html).toContain('minlength="2"');
      expect(html).toContain('maxlength="5000"');
      expect(html).toContain('required=""');
      expect(html).toContain(copy.publishComment);
    },
  );

  it("POSTs normalized text to the encoded comment endpoint", async () => {
    const fetchImpl = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({ comment: { id: "cmt_confirmed" } }),
          { status: 201, headers: { "content-type": "application/json" } },
        ),
    );

    await expect(
      submitContentCommentRequest(
        {
          slug: "hello world/one",
          text: "  Useful comment  ",
          fallbackError: "Could not publish",
        },
        fetchImpl,
      ),
    ).resolves.toBe("cmt_confirmed");

    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe("/api/content/hello%20world%2Fone/comments");
    expect(init).toMatchObject({
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Useful comment" }),
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("fails closed when the server does not confirm a comment id", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ success: true }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    await expect(
      submitContentCommentRequest(
        {
          slug: "article",
          text: "Valid text",
          fallbackError: "Could not publish",
        },
        fetchImpl,
      ),
    ).rejects.toThrow("Could not publish");
  });

  it.each(["", " ", "x", "x".repeat(5001)])(
    "rejects invalid client text %j before fetch",
    async (text) => {
      const fetchImpl = vi.fn();
      await expect(
        submitContentCommentRequest(
          {
            slug: "article",
            text,
            fallbackError: "Could not publish",
          },
          fetchImpl,
        ),
      ).rejects.toThrow("2..5000");
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );
});
