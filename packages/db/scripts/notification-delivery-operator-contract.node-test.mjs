import assert from "node:assert/strict";
import test from "node:test";
import {
  assertResetAcknowledgement,
  listNotificationDeliveryChannels,
  NOTIFICATION_DELIVERY_CHANNELS,
  NOTIFICATION_DELIVERY_RESET_ACK,
  parseNotificationDeliveryListLimit,
  parseNotificationDeliveryOperatorArgs,
  resolveNotificationDeliveryChannel,
  usageText,
} from "./notification-delivery-operator-contract.mjs";

test("channels cover fanout sources plus admission recovery", () => {
  assert.deepEqual(
    listNotificationDeliveryChannels().map((item) => item.id),
    ["report", "support", "verification", "discussion", "publication", "admission"],
  );
  assert.equal(NOTIFICATION_DELIVERY_CHANNELS.publication.idColumn, "content_id");
  assert.equal(NOTIFICATION_DELIVERY_CHANNELS.admission.kind, "admission");
});

test("parse list and reset args without inventing bulk resets", () => {
  assert.equal(parseNotificationDeliveryOperatorArgs([]).command, "help");
  assert.deepEqual(parseNotificationDeliveryOperatorArgs(["list"]), {
    command: "list",
    channel: null,
    limit: 20,
  });
  assert.equal(
    parseNotificationDeliveryOperatorArgs(["list", "--channel", "report", "--limit", "5"]).channel
      .id,
    "report",
  );
  assert.deepEqual(
    parseNotificationDeliveryOperatorArgs(["reset", "--channel", "discussion", "--id", "cmt_1"]),
    {
      command: "reset",
      channel: NOTIFICATION_DELIVERY_CHANNELS.discussion,
      id: "cmt_1",
    },
  );
  assert.throws(
    () => parseNotificationDeliveryOperatorArgs(["reset", "--channel", "report"]),
    /--id/u,
  );
  assert.throws(() => parseNotificationDeliveryOperatorArgs(["reset", "--id", "x"]), /--channel/u);
  assert.throws(
    () => parseNotificationDeliveryOperatorArgs(["list", "--all"]),
    /Unsupported option/u,
  );
});

test("reset acknowledgement is mandatory and list limits stay bounded", () => {
  assert.throws(
    () => assertResetAcknowledgement({}),
    new RegExp(NOTIFICATION_DELIVERY_RESET_ACK, "u"),
  );
  assert.doesNotThrow(() =>
    assertResetAcknowledgement({ [NOTIFICATION_DELIVERY_RESET_ACK]: "YES" }),
  );
  assert.equal(parseNotificationDeliveryListLimit("7"), 7);
  assert.throws(() => parseNotificationDeliveryListLimit("0"), /1 to 100/u);
  assert.throws(() => parseNotificationDeliveryListLimit("101"), /1 to 100/u);
});

test("usage names every channel and forbids silent all-reset", () => {
  const text = usageText();
  for (const channel of Object.keys(NOTIFICATION_DELIVERY_CHANNELS)) {
    assert.match(text, new RegExp(channel, "u"));
  }
  assert.match(text, /never resets every job/u);
  assert.equal(resolveNotificationDeliveryChannel("REPORT")?.id, "report");
  assert.equal(resolveNotificationDeliveryChannel("nope"), null);
});
