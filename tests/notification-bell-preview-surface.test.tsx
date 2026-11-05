import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0 }));
vi.mock("react", async (importOriginal) => {
  const React = await importOriginal<typeof import("react")>();
  return {
    ...React,
    useEffect: () => undefined,
    useState: (initial: unknown) => {
      const index = harness.cursor++;
      if (!(index in harness.slots)) {
        if (index === 3) harness.slots[index] = false;
        else if (index === 4) harness.slots[index] = true;
        else harness.slots[index] = initial;
      }
      return [
        harness.slots[index],
        (value: unknown) => {
          harness.slots[index] = value;
        },
      ];
    },
  };
});
vi.mock("next/link", () => ({ default: "a" }));

import { LocaleProvider } from "../apps/web/src/components/locale-context";
import { NotificationBell } from "../apps/web/src/components/notification-bell";

beforeEach(() => {
  harness.slots = [];
  harness.cursor = 0;
});

it("marks the notification preview busy before the first poll completes", () => {
  const html = renderToStaticMarkup(
    <LocaleProvider locale="en">
      <NotificationBell />
    </LocaleProvider>,
  );
  expect(html).toContain('aria-busy="true"');
});

it("renders empty preview through EmptyState with honesty hint copy", () => {
  harness.slots = [[], 0, "usr_1", true, true, null, null, false, 0];
  harness.cursor = 0;
  const html = renderToStaticMarkup(
    <LocaleProvider locale="en">
      <NotificationBell />
    </LocaleProvider>,
  );
  expect(html).toContain("No notifications yet");
  expect(html).toContain(
    "New notifications appear in this preview when activity reaches your account.",
  );
  expect(html).toContain("border-dashed");
  expect(html).not.toContain('class="py-6 text-center font-caption text-muted"');
});
