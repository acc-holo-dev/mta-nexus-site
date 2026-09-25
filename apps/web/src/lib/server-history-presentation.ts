export type ServerHistoryPoint = Readonly<{
  observedAt: string;
  currentPlayers: number | null;
  maxPlayers: number | null;
}>;

export function selectServerHistoryChartPoints(
  observations: readonly ServerHistoryPoint[],
  maxPoints = 24,
): ServerHistoryPoint[] {
  const boundedMaxPoints = Number.isFinite(maxPoints)
    ? Math.min(Math.max(Math.floor(maxPoints), 2), 48)
    : 24;

  if (observations.length <= boundedMaxPoints) return [...observations];

  const lastIndex = observations.length - 1;
  const selected: ServerHistoryPoint[] = [];

  for (let index = 0; index < boundedMaxPoints; index += 1) {
    const sourceIndex = Math.round(
      (index * lastIndex) / (boundedMaxPoints - 1),
    );
    const point = observations[sourceIndex];
    if (point && selected.at(-1) !== point) selected.push(point);
  }

  return selected;
}

export function serverHistoryBarPercent(
  value: number | null,
  peak: number | null,
): number {
  if (value == null || peak == null || peak <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((value / peak) * 100)));
}

export function formatObservationTimeUtc(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(
    date.getUTCMinutes(),
  ).padStart(2, "0")} UTC`;
}
