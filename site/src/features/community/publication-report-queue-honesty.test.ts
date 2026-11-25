import { expect, it } from "vitest";
import {
  communityReportCopy,
  publicationReportLoadFailureDescription,
  publicationReportQueueEmpty,
  publicationReportsAreFiltered,
} from "./community-report-copy";
import { reportGroupsCopy } from "./community-report-groups-copy";

const pending = { view: "pending", page: 1 };

it("describes a failed publication report load as unavailable, not an unsaved form or an empty queue", () => {
  const copy = communityReportCopy("en");
  const failure = publicationReportLoadFailureDescription("en", "INTERNAL_ERROR");
  expect(failure).toBe(copy.unavailableHint);
  expect(failure).not.toBe(copy.formErrorHint);
  expect(failure).not.toBe(copy.empty);
  expect(publicationReportLoadFailureDescription("en", "VALIDATION_ERROR")).toBe(
    copy.queryInvalidHint,
  );
});

it("keeps an unfiltered empty publication report queue distinct from a filter miss and a load failure", () => {
  const copy = communityReportCopy("en");
  expect(publicationReportsAreFiltered(pending)).toBe(false);
  expect(publicationReportQueueEmpty("en", false)).toEqual({
    title: copy.empty,
    description: copy.description,
  });
  expect(publicationReportQueueEmpty("en", false).title).not.toBe(
    reportGroupsCopy("en").publicationEmpty,
  );
  expect(publicationReportQueueEmpty("en", false).title).not.toBe(copy.unavailable);

  expect(publicationReportsAreFiltered({ ...pending, query: "spam" })).toBe(true);
  expect(publicationReportsAreFiltered({ ...pending, view: "history" })).toBe(true);
  expect(publicationReportsAreFiltered({ ...pending, page: 2 })).toBe(true);
  expect(publicationReportQueueEmpty("ru", true).title).toBe(
    communityReportCopy("ru").emptyFiltered,
  );
});
