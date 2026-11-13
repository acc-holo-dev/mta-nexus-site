import { expect, it } from "vitest";
import { confirmedCollectionCommand } from "../../site/src/lib/library-collections-confirmation";
import {
  libraryCollectionsContractCreate as create,
  libraryCollectionsContractCurrent as current,
  libraryCollectionsContractReply as reply,
  libraryCollectionsContractRequestId as requestId,
} from "../helpers/library-collections-contract-harness";

it("confirms creation only with a complete matching private receipt", () => {
  expect(confirmedCollectionCommand(reply(), create)).toBe(current.id);
  for (const body of [
    null,
    {},
    { ...reply(), replayed: undefined },
    {
      ...reply(),
      receipt: { ...reply().receipt, requestId: "67ca0352-de64-4af9-9e54-7d3c56fe8d88" },
    },
    reply(create, { ...current, revision: 2 }),
    reply(create, { ...current, name: "Other", revision: 1 }),
  ])
    expect(confirmedCollectionCommand(body, create)).toBeNull();
});
it("does not confirm another collection, revision, action or hidden grant", () => {
  const command = { requestId, action: "archive" as const, expectedRevision: 4 },
    body = {
      ...reply(),
      receipt: {
        ...reply().receipt,
        command,
        collection: { ...current, status: "archived", revision: 5 },
      },
    };
  expect(confirmedCollectionCommand(body, command, current)).toBe(current.id);
  for (const change of [
    { id: "lcol_other" },
    { revision: 6 },
    { status: "active" },
    { name: "Changed" },
    { entitlement: "ent_a" },
  ])
    expect(
      confirmedCollectionCommand(
        {
          ...body,
          receipt: { ...body.receipt, collection: { ...body.receipt.collection, ...change } },
        },
        command,
        current,
      ),
    ).toBeNull();
});
