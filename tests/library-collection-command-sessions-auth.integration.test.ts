import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  applyLibraryMembershipBatch,
  fixture,
  type LibraryCollectionCommand,
  libraryCollectionsRepository,
  sessionRepository,
} from "./helpers/library-collection-command-sessions-harness";

describe("library collection command sessions: auth rejection and replay", () => {
  it("rejects revoked, expired and foreign initiating tokens for new commands and whole membership batches even with another live session", async () => {
    const f = await fixture(),
      before = await f.snapshot();
    await sessionRepository.delete(f.currentToken);
    for (const token of [f.currentToken, f.expired, f.foreign, ""]) {
      await expect(f.batch(token)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      await expect(
        f.command({ requestId: randomUUID(), action: "create", name: "Denied" }, undefined, token),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    }
    expect(await f.snapshot()).toEqual(before);
  });

  it("reauthenticates immutable command and batch replays, while a surviving initiating session can replay the same receipts", async () => {
    const f = await fixture(),
      body = {
        requestId: randomUUID(),
        action: "rename" as const,
        name: "Saved",
        expectedRevision: 2,
      };
    const saved = await f.command(body, f.source);
    // The prepared membership proof must use the successor source revision.
    const changes = [
      { collectionId: f.source, expectedRevision: 3, wasInCollection: true, inCollection: false },
      {
        collectionId: f.destination,
        expectedRevision: 1,
        wasInCollection: false,
        inCollection: true,
      },
    ];
    const requestId = randomUUID();
    const batch = (currentToken: string) =>
      applyLibraryMembershipBatch({
        userId: f.userId,
        currentToken,
        productId: f.productId,
        command: { requestId, changes },
        receiptId: `lmb_${randomUUID()}`,
        auditId: `aud_${randomUUID()}`,
        children: changes.map(({ collectionId }) => ({
          collectionId,
          receiptId: `lcr_${randomUUID()}`,
          auditId: `aud_${randomUUID()}`,
        })),
      });
    const savedBatch = await batch(f.currentToken),
      before = await f.snapshot();
    await sessionRepository.delete(f.currentToken);
    for (const token of [f.currentToken, f.expired, f.foreign]) {
      await expect(batch(token)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      await expect(f.command(body, f.source, token)).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    }
    expect(await f.command(body, f.source, f.survivor)).toEqual({ ...saved, replayed: true });
    expect(await batch(f.survivor)).toEqual({ ...savedBatch, replayed: true });
    expect(await f.snapshot()).toEqual(before);
  });

  it("guards each collection command preparation path before its first protected write", async () => {
    const f = await fixture(),
      preview = await libraryCollectionsRepository.copyPreview(f.userId, f.source);
    const archived = (
      await f.command({ requestId: randomUUID(), action: "create", name: "Archived" })
    ).receipt.collection.id;
    await f.command({ requestId: randomUUID(), action: "archive", expectedRevision: 1 }, archived);
    const before = await f.snapshot();
    await sessionRepository.delete(f.currentToken);
    const existing = { expectedRevision: 1, requestId: randomUUID() };
    const operations: [LibraryCollectionCommand, string | undefined][] = [
      [
        {
          action: "duplicate",
          name: "Copy",
          sourceCollectionId: f.source,
          expectedRevision: 2,
          expectedItemCount: 1,
          sourceDigest: preview.sourceDigest,
          requestId: randomUUID(),
        },
        undefined,
      ],
      [{ ...existing, action: "rename", name: "Denied" }, f.destination],
      [{ ...existing, action: "archive" }, f.destination],
      [{ ...existing, action: "restore", expectedRevision: 2 }, archived],
      [{ ...existing, action: "add", productId: f.productId }, f.destination],
      [{ ...existing, action: "add-many", productIds: [f.productId] }, f.destination],
      [{ ...existing, action: "remove", productId: f.productId, expectedRevision: 2 }, f.source],
      [
        { ...existing, action: "remove-many", productIds: [f.productId], expectedRevision: 2 },
        f.source,
      ],
      [
        {
          ...existing,
          action: "copy-items",
          sourceCollectionId: f.source,
          expectedSourceRevision: 2,
          productIds: [f.productId],
        },
        f.destination,
      ],
      [
        {
          ...existing,
          action: "move-items",
          sourceCollectionId: f.source,
          expectedSourceRevision: 2,
          productIds: [f.productId],
        },
        f.destination,
      ],
      [
        {
          ...existing,
          action: "reconcile-items",
          addProductIds: [f.productId],
          removeProductIds: [],
        },
        f.destination,
      ],
    ];
    for (const [body, id] of operations)
      await expect(f.command(body, id)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(await f.snapshot()).toEqual(before);
  });
});
