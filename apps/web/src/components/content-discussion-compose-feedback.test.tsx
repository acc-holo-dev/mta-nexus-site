import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getDiscussionCopy } from "../lib/content-discussion-copy";
import { DiscussionComposeWriteFeedback } from "./content-discussion-compose-feedback";

describe("discussion compose write feedback", () => {
  it.each(["en", "ru"] as const)(
    "surfaces a prominent sign-in action after unauthorized publish in %s",
    (locale) => {
      const copy = getDiscussionCopy(locale);
      const html = renderToStaticMarkup(
        createElement(DiscussionComposeWriteFeedback, {
          error: copy.invalid,
          needsSignIn: true,
          loginHref: "/auth/login?next=%2Farticles%2Fguide",
          signInLabel: copy.signIn,
          registerHref: "/auth/register?next=%2Farticles%2Fguide",
          registerLabel: "Create account",
          onPersistDraft: () => undefined,
        }),
      );
      expect(html).toContain('role="alert"');
      expect(html).toContain(copy.invalid);
      expect(html).toContain('href="/auth/login?next=%2Farticles%2Fguide"');
      expect(html).toContain('href="/auth/register?next=%2Farticles%2Fguide"');
      expect(html).toContain(copy.signIn);
      expect(html).toContain("min-h-11");
      expect(html).toContain("bg-accent");
    },
  );

  it("keeps generic write failures text-only", () => {
    const html = renderToStaticMarkup(
      createElement(DiscussionComposeWriteFeedback, {
        error: "Could not confirm the comment.",
        needsSignIn: false,
        loginHref: "/auth/login",
        signInLabel: "Sign in to join the discussion",
        onPersistDraft: () => undefined,
      }),
    );
    expect(html).toContain('role="alert"');
    expect(html).not.toContain('href="/auth/login"');
  });
});
