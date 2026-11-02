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
        if (index === 2) harness.slots[index] = false;
        else if (index === 3) harness.slots[index] = true;
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
