export type BuildModerationUiState = {
  hasNotes: boolean;
  hasTrustedCleanScan: boolean;
  canApprove: boolean;
  canReject: boolean;
};

export function buildModerationUiState(input: {
  scanStatus: string;
  hasScanProvenance: boolean;
  notes: string;
  pending: "approve" | "reject" | null;
}): BuildModerationUiState {
  const hasNotes = input.notes.trim().length >= 3;
  const hasTrustedCleanScan =
    input.scanStatus === "clean" && input.hasScanProvenance;
  const idle = input.pending === null;

  return {
    hasNotes,
    hasTrustedCleanScan,
    canApprove: hasTrustedCleanScan && hasNotes && idle,
    canReject: hasNotes && idle,
  };
}
