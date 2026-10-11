import { libraryCollectionsRepository } from "@nexus/db";
import { AppError, type User } from "@nexus/domain";
import { generateId } from "@nexus/security";
import { libraryCollectionCommandSchema } from "@nexus/validation";
import { collectionId } from "../library-collections-query";
export const libraryCollectionsService = {
  page: (actor: User, query: { page: number; status: "all" | "active" | "archived" }) =>
    libraryCollectionsRepository.page(actor.id, query.page, query.status),
  detail: (actor: User, id: string, query: { page: number; q: string }, candidates = false) =>
    libraryCollectionsRepository.detail(
      actor.id,
      collectionId(id),
      query.page,
      query.q,
      candidates,
    ),
  history: (actor: User, id: string, page: number) =>
    libraryCollectionsRepository.history(actor.id, collectionId(id), page),
  command(actor: User, input: unknown, id?: string) {
    const parsed = libraryCollectionCommandSchema.safeParse(input);
    if (!parsed.success || (parsed.data.action === "create") !== (id === undefined))
      throw new AppError("Invalid collection command", 400, "COLLECTION_INVALID");
    return libraryCollectionsRepository.command({
      userId: actor.id,
      command: parsed.data,
      collectionId: id === undefined ? undefined : collectionId(id),
      newCollectionId: generateId("lcol"),
      receiptId: generateId("lcr"),
      auditId: generateId("aud"),
    });
  },
};
