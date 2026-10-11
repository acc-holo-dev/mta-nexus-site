import { librarySelectionBatchesRepository } from "@nexus/db";
import { AppError, type User } from "@nexus/domain";
import { generateId } from "@nexus/security";
import {
  librarySelectionBatchChoiceSchema,
  librarySelectionBatchCommandSchema,
} from "@nexus/validation";
import { collectionId } from "../library-collections-query";
export const librarySelectionBatchesService = {
  preview(actor: User, id: string, input: unknown) {
    const parsed = librarySelectionBatchChoiceSchema.safeParse(input);
    if (!parsed.success)
      throw new AppError("Invalid selection batch", 400, "SELECTION_BATCH_INVALID");
    return librarySelectionBatchesRepository.preview(actor.id, collectionId(id), parsed.data);
  },
  command(actor: User, id: string, input: unknown) {
    const parsed = librarySelectionBatchCommandSchema.safeParse(input);
    if (!parsed.success)
      throw new AppError("Invalid selection batch", 400, "SELECTION_BATCH_INVALID");
    return librarySelectionBatchesRepository.command({
      userId: actor.id,
      collectionId: collectionId(id),
      command: parsed.data,
      receiptId: generateId("lsbr"),
      auditId: generateId("aud"),
    });
  },
  history: (actor: User, id: string, page: number) =>
    librarySelectionBatchesRepository.history(actor.id, collectionId(id), page),
};
