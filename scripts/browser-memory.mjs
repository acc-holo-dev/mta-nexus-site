import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

// Sample exactly the processes belonging to this Playwright Chromium instance.
// Summed RSS includes shared pages more than once; this is a regression metric.
export async function startBrowserMemoryProbe(browser) {
  assert.equal(process.platform, "linux");
  const session = await browser.newBrowserCDPSession();
  const samples = [];
  async function sample() {
    const { processInfo } = await session.send("SystemInfo.getProcessInfo");
    let rssKiB = 0;
    let measured = 0;
    for (const { id } of processInfo) {
      try {
        const status = await readFile(`/proc/${id}/status`, "utf8");
        const match = status.match(/^VmRSS:\s+(\d+) kB$/mu);
        if (match) { rssKiB += Number(match[1]); measured++; }
      } catch (error) {
        if (error.code !== "ENOENT" && error.code !== "ESRCH") throw error;
      }
    }
    assert(measured > 0, "Chromium process RSS must be observable");
    samples.push({ timeMs: performance.now(), rssKiB, processes: measured });
  }
  try { await sample(); }
  catch (error) { await session.detach(); throw error; }
  const baselineRssKiB = samples[0].rssKiB;
  let running = true;
  const sampler = (async () => {
    while (running) { await delay(50); if (running) await sample(); }
  })();
  // Attach a handler immediately, then propagate any sampling failure in stop().
  sampler.catch(() => {});
  return async () => {
    running = false;
    try {
      await sampler;
      await sample();
      const peakRssKiB = Math.max(...samples.map(item => item.rssKiB));
      return { baselineRssKiB, peakRssKiB,
        growthKiB: Math.max(0, peakRssKiB - baselineRssKiB), samples,
        limitations: "50 ms samples of summed Chromium process RSS, including shared pages and browser download storage. Not an exact peak, unique physical memory, JS heap alone or a production device guarantee." };
    } finally { await session.detach(); }
  };
}
