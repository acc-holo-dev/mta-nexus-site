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

import { submitContentCommentRequest } from "../lib/content-comment-client";
import { ContentCommentForm } from "./content-comment-form";

describe("content discussion form", () => {
  beforeEach(() => {
    state.locale = "en";
  });

  it.each(["en", "ru"] as const)("renders the localized protected comment form in %s", (locale) => {
    state.locale = locale;
    const html = renderToStaticMarkup(
      createElement(ContentCommentForm, { slug: "hello world/one", actorId: "usr_a" }),
    );
    const copy = getDictionary(locale).articles;
    expect(html).toContain(copy.joinDiscussion);
    expect(html).toMatch(/minlength="2"/iu);
    expect(html).toMatch(/maxlength="5000"/iu);
    expect(html).toContain('required=""');
    expect(html).toContain(copy.publishComment);
  });

  const INTENT = "12345678-1234-4234-8234-123456789abc";

  it("POSTs normalized text with Idempotency-Key to the encoded comment endpoint", async () => {
    const fetchImpl = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            comment: { id: "cmt_12345678123442348234123456789abc", authorId: "usr_a" },
          }),
          {
            status: 201,
            headers: { "content-type": "application/json" },
          },
        ),
    );

    await expect(
      submitContentCommentRequest(
        {
          slug: "hello world/one",
          text: "  Useful comment  ",
          intentKey: INTENT,
          expectedActorId: "usr_a",
          fallbackError: "Could not publish",
        },
        fetchImpl,
      ),
    ).resolves.toBe("cmt_12345678123442348234123456789abc");

    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe("/api/content/hello%20world%2Fone/comments");
    expect(init).toMatchObject({
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": INTENT,
        "x-nexus-actor-id": "usr_a",
      },
      body: JSON.stringify({ text: "Useful comment" }),
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("fails closed when the server does not confirm a comment id", async () => {
    const fetchImpl = vi.fn(
      async () =>
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
          intentKey: INTENT,
          expectedActorId: "usr_a",
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
            intentKey: INTENT,
            expectedActorId: "usr_a",
            fallbackError: "Could not publish",
          },
          fetchImpl,
        ),
      ).rejects.toThrow("2..5000");
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );
});
