import { publicationNotificationDeliveryRepository } from "@nexus/db";

/** Drain durable publication fanout pages until idle (tests / operator tooling). */
export async function drainPublicationNotificationDelivery(limit = 20) {
  const pages: Array<
    Awaited<ReturnType<typeof publicationNotificationDeliveryRepository.processNext>>
  > = [];
  for (let page = 0; page < 40; page++) {
    const result = await publicationNotificationDeliveryRepository.processNext(limit);
    if (result.state === "idle") break;
    pages.push(result);
  }
  return pages;
}
