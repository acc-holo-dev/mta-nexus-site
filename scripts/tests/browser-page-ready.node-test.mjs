import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classifyDocumentState,
  evidenceScreenshotPath,
  GLOBAL_LOADING_LABELS,
  PAGE_EVIDENCE_STATES,
} from "../browser-page-ready.mjs";

test("ready evidence paths omit the ready suffix by default", () => {
  assert.equal(
    evidenceScreenshotPath("/tmp/portfolio-en-developers-390.png", "ready"),
    "/tmp/portfolio-en-developers-390.png",
  );
});

test("loading empty and error evidence paths keep distinct suffixes", () => {
  assert.equal(
    evidenceScreenshotPath("/tmp/portfolio-en-developers-390.png", "loading"),
    "/tmp/portfolio-en-developers-390-loading.png",
  );
  assert.equal(
    evidenceScreenshotPath("/tmp/portfolio-en-developers-390.png", "empty"),
    "/tmp/portfolio-en-developers-390-empty.png",
  );
  assert.equal(
    evidenceScreenshotPath("/tmp/portfolio-en-developers-390.png", "error"),
    "/tmp/portfolio-en-developers-390-error.png",
  );
  assert.equal(
    evidenceScreenshotPath("/tmp/portfolio-en-developers-390.png", "ready", {
      omitReadySuffix: false,
    }),
    "/tmp/portfolio-en-developers-390-ready.png",
  );
});

test("rejects unknown evidence states for screenshot naming", () => {
  assert.throws(() => evidenceScreenshotPath("/tmp/x.png", "pending"), /Unknown evidence state/u);
});

test("classifies the global loading skeleton ahead of heading content", () => {
  assert.equal(
    classifyDocumentState({
      loadingStatusVisible: true,
      mainHeadingCount: 1,
      errorHeadingVisible: false,
      emptyStateVisible: false,
      resourceTitleCount: 24,
    }),
    "loading",
  );
});

test("classifies settled main content as ready", () => {
  assert.equal(
    classifyDocumentState({
      loadingStatusVisible: false,
      mainHeadingCount: 1,
      errorHeadingVisible: false,
      emptyStateVisible: false,
      resourceTitleCount: 24,
    }),
    "ready",
  );
});

test("classifies error and empty ahead of a bare ready heading", () => {
  assert.equal(
    classifyDocumentState({
      loadingStatusVisible: false,
      mainHeadingCount: 1,
      errorHeadingVisible: true,
      emptyStateVisible: false,
      resourceTitleCount: 0,
    }),
    "error",
  );
  assert.equal(
    classifyDocumentState({
      loadingStatusVisible: false,
      mainHeadingCount: 1,
      errorHeadingVisible: false,
      emptyStateVisible: true,
      resourceTitleCount: 0,
    }),
    "empty",
  );
});

test("treats missing main heading without an error banner as still loading", () => {
  assert.equal(
    classifyDocumentState({
      loadingStatusVisible: false,
      mainHeadingCount: 0,
      errorHeadingVisible: false,
      emptyStateVisible: false,
      resourceTitleCount: 0,
    }),
    "loading",
  );
});

test("exports the localized GlobalLoading labels used by site loading.tsx", () => {
  assert.deepEqual([...GLOBAL_LOADING_LABELS], ["Loading content", "Загрузка содержимого"]);
  assert.deepEqual([...PAGE_EVIDENCE_STATES], ["ready", "loading", "empty", "error"]);
});
