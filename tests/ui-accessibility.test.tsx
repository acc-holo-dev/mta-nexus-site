import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Avatar } from "../packages/ui/src/avatar";
import { EmptyState } from "../packages/ui/src/empty-state";
import { Input } from "../packages/ui/src/input";
import { Tabs, nextTabIndex } from "../packages/ui/src/tabs";

describe("Input accessibility wiring", () => {
  it("auto-generates a stable field id for labels and errors", () => {
    const markup = renderToStaticMarkup(
      <Input label="Email" error="Email is required" />,
    );

    const id = markup.match(/<input[^>]*id="([^"]+)"/u)?.[1];
    expect(id).toBeTruthy();
    expect(markup).toContain(`for="${id}"`);
    expect(markup).toContain(`aria-describedby="${id}-error"`);
    expect(markup).toContain(`id="${id}-error"`);
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('role="alert"');
  });

  it("preserves an explicit caller-provided id", () => {
    const markup = renderToStaticMarkup(
      <Input id="account-email" label="Email" error="Invalid email" />,
    );

    expect(markup).toContain('id="account-email"');
    expect(markup).toContain('for="account-email"');
    expect(markup).toContain('aria-describedby="account-email-error"');
  });
});

describe("Tabs keyboard navigation", () => {
  it("wraps horizontal arrow navigation and supports Home/End", () => {
    expect(nextTabIndex(3, 0, "ArrowLeft")).toBe(2);
    expect(nextTabIndex(3, 2, "ArrowRight")).toBe(0);
    expect(nextTabIndex(3, 1, "Home")).toBe(0);
    expect(nextTabIndex(3, 1, "End")).toBe(2);
    expect(nextTabIndex(3, 1, "Enter")).toBeNull();
  });

  it("renders one sequential tab stop with ARIA tab semantics", () => {
    const markup = renderToStaticMarkup(
      <Tabs
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "activity", label: "Activity" },
          { id: "settings", label: "Settings" },
        ]}
        activeTab="activity"
        onChange={() => undefined}
      />,
    );

    expect(markup).toContain('role="tablist"');
    expect(markup).toContain('aria-orientation="horizontal"');
    expect((markup.match(/role="tab"/gu) ?? []).length).toBe(3);
    expect((markup.match(/tabindex="0"/gu) ?? []).length).toBe(1);
    expect((markup.match(/tabindex="-1"/gu) ?? []).length).toBe(2);
    expect((markup.match(/aria-selected="true"/gu) ?? []).length).toBe(1);
  });

  it("keeps the first tab reachable when activeTab is temporarily invalid", () => {
    const markup = renderToStaticMarkup(
      <Tabs
        tabs={[
          { id: "one", label: "One" },
          { id: "two", label: "Two" },
        ]}
        activeTab="missing"
        onChange={() => undefined}
      />,
    );

    expect((markup.match(/tabindex="0"/gu) ?? []).length).toBe(1);
  });
});


describe("Shared non-text accessibility", () => {
  it("gives an avatar fallback an image role and accessible name", () => {
    const markup = renderToStaticMarkup(
      <Avatar fallback="HN" alt="Holo Nexus" />,
    );

    expect(markup).toContain('role="img"');
    expect(markup).toContain('aria-label="Holo Nexus"');
    expect(markup).toContain('aria-hidden="true"');
  });

  it("keeps the default empty-state icon decorative", () => {
    const markup = renderToStaticMarkup(
      <EmptyState title="Nothing here" description="No records found." />,
    );

    expect(markup).toContain('aria-hidden="true"');
  });
});
