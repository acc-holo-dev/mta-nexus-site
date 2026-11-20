export const serverHistoryWindows = { "24h": 24, "7d": 168, "30d": 720 } as const;
export type ServerHistoryWindow = keyof typeof serverHistoryWindows;

export function parseServerHistoryWindow(
  value: string | string[] | undefined,
): ServerHistoryWindow {
  return value === "7d" || value === "30d" ? value : "24h";
}
