import { z } from "zod";
import { organizationPublicationHistorySchema } from "./organization-publication-history-contract";
export const serverPublicationHistorySchema = organizationPublicationHistorySchema
  .omit({ organization: true })
  .extend({ server: z.object({ id: z.string().min(1).max(128), name: z.string() }).strict() })
  .strict();
export function confirmedServerPublicationRestore(
  value: unknown,
  id: string,
  serverId: string,
  previous: string,
) {
  const parsed = z
    .object({
      id: z.literal(id),
      serverId: z.literal(serverId),
      status: z.literal("draft"),
      revision: serverPublicationHistorySchema.shape.item.shape.revision,
    })
    .strict()
    .safeParse(value);
  return parsed.success && parsed.data.revision > previous;
}
