/**
 * Visual-evidence readiness helpers for Playwright acceptance.
 *
 * Ready captures must wait for stable final content. Loading / empty / error
 * frames are named separately when retained — never as the default "ready" PNG.
 *
 * Mirrors site/src/app/loading.tsx (role=status + localized aria-label).
 */

export const GLOBAL_LOADING_LABELS = Object.freeze(["Loading content", "Загрузка содержимого"]);

export const PAGE_EVIDENCE_STATES = Object.freeze(["ready", "loading", "empty", "error"]);

/** Append `-{state}` before the extension unless state is ready and omitReadySuffix. */
export function evidenceScreenshotPath(basePath, state = "ready", { omitReadySuffix = true } = {}) {
  if (!PAGE_EVIDENCE_STATES.includes(state)) {
    throw new Error(`Unknown evidence state: ${state}`);
  }
  if (state === "ready" && omitReadySuffix) return basePath;
  const match = basePath.match(/^(.*)(\.[^.]+)$/u);
  if (!match) return `${basePath}-${state}`;
  return `${match[1]}-${state}${match[2]}`;
}

/**
 * Pure classifier for a document snapshot collected in the browser.
 * @param {{
 *   loadingStatusVisible: boolean,
 *   mainHeadingCount: number,
 *   errorHeadingVisible: boolean,
 *   emptyStateVisible: boolean,
 *   resourceTitleCount?: number,
 * }} snapshot
 */
export function classifyDocumentState(snapshot) {
  if (snapshot.loadingStatusVisible) return "loading";
  if (snapshot.errorHeadingVisible) return "error";
  if (snapshot.emptyStateVisible && (snapshot.resourceTitleCount ?? 0) === 0) return "empty";
  if (snapshot.mainHeadingCount >= 1) return "ready";
  return "loading";
}

/**
 * Browser-side probe. Intended for page.evaluate(inspectDocumentReadiness, args).
 * Keep this self-contained: Playwright serializes the function into the page.
 */
export function inspectDocumentReadiness({
  loadingLabels = ["Loading content", "Загрузка содержимого"],
  errorHeadingTexts = [],
  emptyStateTexts = [],
} = {}) {
  const visible = (element) =>
    element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden";

  const loadingStatusVisible = [...document.querySelectorAll('[role="status"]')].some((element) => {
    if (!visible(element)) return false;
    const label = element.getAttribute("aria-label")?.trim() ?? "";
    return loadingLabels.includes(label);
  });

  const mains = [...document.querySelectorAll("main")].filter(visible);
  const mainHeadingCount = mains
    .flatMap((main) => [...main.querySelectorAll("h1")])
    .filter(visible)
    .filter((heading) => heading.textContent?.trim()).length;

  const textOf = (element) => element.textContent?.trim() ?? "";
  const visibleHeadings = [...document.querySelectorAll("h1, h2")].filter(visible);
  const errorHeadingVisible =
    errorHeadingTexts.length > 0 &&
    visibleHeadings.some((heading) => errorHeadingTexts.includes(textOf(heading)));

  const emptyStateVisible =
    emptyStateTexts.length > 0 &&
    [...document.querySelectorAll("h2, h3, p")].some(
      (element) => visible(element) && emptyStateTexts.includes(textOf(element)),
    );

  const resourceTitleCount = [...document.querySelectorAll("#resources h3")].filter(visible).length;

  return {
    loadingStatusVisible,
    mainHeadingCount,
    errorHeadingVisible,
    emptyStateVisible,
    resourceTitleCount,
    href: location.href,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait until the document settles into the requested evidence state.
 * Defaults to ready: no global Loading skeleton, at least one main H1.
 */
export async function waitForPageEvidenceState(
  page,
  {
    state = "ready",
    timeout = 15_000,
    loadingLabels = GLOBAL_LOADING_LABELS,
    errorHeadingTexts = [],
    emptyStateTexts = [],
    stableMs = 150,
    pollMs = 50,
  } = {},
) {
  if (!PAGE_EVIDENCE_STATES.includes(state)) {
    throw new Error(`Unknown evidence state: ${state}`);
  }

  const deadline = Date.now() + timeout;
  let stableSince = 0;
  let last = null;

  while (Date.now() < deadline) {
    last = await page.evaluate(inspectDocumentReadiness, {
      loadingLabels: [...loadingLabels],
      errorHeadingTexts,
      emptyStateTexts,
    });
    const current = classifyDocumentState(last);
    if (current === state) {
      if (!stableSince) stableSince = Date.now();
      if (Date.now() - stableSince >= stableMs) return last;
    } else {
      stableSince = 0;
    }
    await sleep(pollMs);
  }

  throw new Error(
    `Timed out waiting for page evidence state "${state}" after ${timeout}ms; last=${JSON.stringify(
      last,
    )}`,
  );
}

/** Convenience: wait for ready visual state before capture or axe. */
export async function waitForReadyCapture(page, options = {}) {
  return waitForPageEvidenceState(page, { ...options, state: "ready" });
}

/**
 * Capture a named evidence PNG. Ready waits for settled content; other states
 * wait for that named state and keep a distinct filename suffix.
 */
export async function capturePageEvidence(
  page,
  { path, state = "ready", fullPage = true, omitReadySuffix = true, waitOptions = {} } = {},
) {
  await waitForPageEvidenceState(page, { ...waitOptions, state });
  const output = evidenceScreenshotPath(path, state, { omitReadySuffix });
  await page.screenshot({ path: output, fullPage });
  return { path: output, state };
}
