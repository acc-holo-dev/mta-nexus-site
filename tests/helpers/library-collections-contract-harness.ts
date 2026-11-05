/** Shared fixtures for library-collections contract suites. */
export const libraryCollectionsContractRequestId = "67ca0352-de64-4af9-9e54-7d3c56fe8d89";

export const libraryCollectionsContractCurrent = {
  id: "lcol_a",
  name: "Core",
  status: "active" as const,
  revision: 4,
};

export const libraryCollectionsContractCreate = {
  requestId: libraryCollectionsContractRequestId,
  action: "create" as const,
  name: "Core",
};

export function libraryCollectionsContractReply(
  command = libraryCollectionsContractCreate,
  collection = { ...libraryCollectionsContractCurrent, revision: 1 },
) {
  return {
    replayed: false,
    receipt: {
      id: "lcr_a",
      requestId: libraryCollectionsContractRequestId,
      command,
      collection,
      createdAt: "2026-10-11T00:00:00.000Z",
    },
  };
}
