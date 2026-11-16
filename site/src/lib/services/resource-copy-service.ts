import { resourceCopiesRepository } from "@nexus/db";
import { AppError, eventBus, type User } from "@nexus/domain";
import { generateId } from "@nexus/security";
import { resourceCopyCommandSchema } from "@nexus/validation";
import { resourceCopyId } from "../resource-copy-query";
export const resourceCopyService = {
  preview: (actor: User, sourceId: string) =>
    resourceCopiesRepository.preview(actor.id, resourceCopyId(sourceId)),
  async create(actor: User, sourceId: string, input: unknown) {
    const parsed = resourceCopyCommandSchema.safeParse(input);
    if (!parsed.success) throw new AppError("Invalid copy command", 400, "RESOURCE_COPY_INVALID");
    const result = await resourceCopiesRepository.create(
      actor.id,
      resourceCopyId(sourceId),
      parsed.data,
    );
    if (!result.replayed) {
      try {
        await eventBus.publish({
          id: generateId("evt"),
          type: "product.created",
          version: 1,
          timestamp: new Date().toISOString(),
          actor: { id: actor.id, type: "user" },
          aggregateId: result.receipt.target.id,
          aggregateType: "product",
          payload: {
            productId: result.receipt.target.id,
            title: result.receipt.target.title,
            authorId: result.publisherId,
            type: result.receipt.metadata.type,
            price: 0,
          },
        });
      } catch {
        console.error("Resource copy committed; event dispatch failed", {
          productId: result.receipt.target.id,
        });
      }
    }
    return { receipt: result.receipt, replayed: result.replayed };
  },
  page: (actor: User, sourceId: string, query: { page: number; days: 7 | 30 | 90 | 365 | "all" }) =>
    resourceCopiesRepository.page(actor.id, resourceCopyId(sourceId), query.page, query.days),
  detail: (actor: User, sourceId: string, receiptId: string) =>
    resourceCopiesRepository.detail(actor.id, resourceCopyId(sourceId), resourceCopyId(receiptId)),
};
