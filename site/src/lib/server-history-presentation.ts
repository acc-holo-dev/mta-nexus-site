export type ServerHistorySlot = Readonly<{
  bucketAt: string;
  observationCount: number;
  peakPlayers: number | null;
  maxPlayers: number | null;
}>;

// Empty intervals are unknown placeholders, never fabricated zero-player observations.
export function serverHistoryChartSlots(
  buckets: readonly ServerHistorySlot[],
  windowStart: string,
  windowEnd: string,
  bucketSeconds: number,
): ServerHistorySlot[] {
  const start = new Date(windowStart).getTime();
  const end = new Date(windowEnd).getTime();
  const width = bucketSeconds * 1000;
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end < start ||
    !Number.isSafeInteger(width) ||
    width < 1
  )
    return [];
  const first = Math.floor(start / width) * width;
  const last = Math.floor(end / width) * width;
  const count = (last - first) / width + 1;
  if (count > 48) return [];
  const byTime = new Map(buckets.map((bucket) => [new Date(bucket.bucketAt).getTime(), bucket]));
  return Array.from({ length: count }, (_, index) => {
    const time = first + index * width;
    return (
      byTime.get(time) ?? {
        bucketAt: new Date(time).toISOString(),
        observationCount: 0,
        peakPlayers: null,
        maxPlayers: null,
      }
    );
  });
}

export function serverHistoryBarPercent(value: number | null, peak: number | null): number {
  if (
    value == null ||
    peak == null ||
    !Number.isFinite(value) ||
    !Number.isFinite(peak) ||
    peak <= 0
  )
    return 0;
  return Math.min(100, Math.max(0, Math.round((value / peak) * 100)));
}

export function formatHistoryIntervalUtc(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}
