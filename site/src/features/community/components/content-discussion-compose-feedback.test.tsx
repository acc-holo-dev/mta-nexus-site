import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getDiscussionCopy } from "../../../lib/content-discussion-copy";
import { DiscussionComposeWriteFeedback } from "./content-discussion-compose-feedback";

describe("discussion compose write feedback", () => {
  it.each(["en", "ru"] as const)(
    "surfaces ErrorState with a prominent sign-in action after unauthorized publish in %s",
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
          locale,
        }),
      );
      expect(html).toContain('role="alert"');
      expect(html).toContain("bg-danger-soft");
      expect(html).toContain(copy.invalid);
      expect(html).toContain(copy.formErrorHint);
      expect(html).toContain('href="/auth/login?next=%2Farticles%2Fguide"');
      expect(html).toContain('href="/auth/register?next=%2Farticles%2Fguide"');
      expect(html).toContain(copy.signIn);
      expect(html).toContain("min-h-11");
      expect(html).toContain("bg-accent");
    },
  );

  it("keeps generic write failures on ErrorState without sign-in links", () => {
    const copy = getDiscussionCopy("en");
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
    expect(html).toContain("bg-danger-soft");
    expect(html).toContain(copy.formErrorHint);
    expect(html).not.toContain('href="/auth/login"');
  });
});
