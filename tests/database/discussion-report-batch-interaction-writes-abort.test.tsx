import { expect, it, vi } from "vitest";
import {
  ack,
  createDiscussionReportBatchInteractionHelpers,
  mockReactHooks,
  preview,
  response,
} from "../helpers/discussion-report-batch-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as (() => void)[],
  fetch: vi.fn(),
  refresh: vi.fn(),
  confirm: vi.fn(),
  reload: vi.fn(),
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));
vi.mock("../../apps/web/src/components/confirm-action", () => ({
  confirmAction: (...args: unknown[]) => harness.confirm(...args),
}));

import { DiscussionReportBatch } from "../../apps/web/src/components/discussion-report-batch";
import { reportBatchCopy } from "../../apps/web/src/lib/report-batch-copy";

const { render, click, select, review } = createDiscussionReportBatchInteractionHelpers(
  harness,
  DiscussionReportBatch,
);

it.each(["preview", "command"])(
  "aborts %s on navigation and ignores late completion",
  async (phase) => {
    if (phase === "command") await review();
    else select();
    let finish!: (reply: Response) => void;
    harness.fetch.mockReturnValue(
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
    );
    click(
      render(),
      phase === "command" ? reportBatchCopy("en").confirm : reportBatchCopy("en").preview,
    );
    const signal = harness.fetch.mock.calls.at(-1)?.[1].signal;
    for (const cleanup of harness.cleanups.splice(0)) cleanup();
    expect(signal.aborted).toBe(true);
    finish(response(phase === "command" ? ack : preview));
    await new Promise((resolve) => setImmediate(resolve));
    expect(harness.refresh).not.toHaveBeenCalled();
  },
);
