import { z } from "zod";

export const profilePrivacyUpdateSchema = z
  .object({
    showActivity: z.boolean(),
    showProfessionalContacts: z.boolean(),
    expectedUpdatedAt: z.iso.datetime(),
  })
  .strict();

export const editablePrivacySchema = profilePrivacyUpdateSchema
  .omit({ expectedUpdatedAt: true })
  .extend({
    id: z.string().min(1).max(128),
    username: z.string().min(1).max(128),
    updatedAt: z.iso.datetime(),
  })
  .strict();
export type EditablePrivacy = z.infer<typeof editablePrivacySchema>;

export function parseEditablePrivacy(value: unknown) {
  const result = editablePrivacySchema.safeParse(value);
  return result.success ? result.data : null;
}

export function confirmedPrivacyUpdate(
  value: unknown,
  previous: EditablePrivacy,
  fields: Pick<EditablePrivacy, "showActivity" | "showProfessionalContacts">,
) {
  if (
    !value ||
    typeof value !== "object" ||
    !("success" in value) ||
    value.success !== true ||
    !("preferences" in value)
  )
    return null;
  const saved = parseEditablePrivacy(value.preferences);
  return saved &&
    saved.id === previous.id &&
    saved.username === previous.username &&
    saved.showActivity === fields.showActivity &&
    saved.showProfessionalContacts === fields.showProfessionalContacts &&
    Date.parse(saved.updatedAt) > Date.parse(previous.updatedAt)
    ? saved
    : null;
}
