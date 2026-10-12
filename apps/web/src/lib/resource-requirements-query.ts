import { AppError, type ResourceRequirementsScope } from "@nexus/domain";
import { mtaVersionSchema } from "@nexus/validation";
import { z } from "zod";

const buildId = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/u);
const querySchema = z
  .object({
    targetMta: mtaVersionSchema.refine((value) => value.trim() === value).optional(),
    buildId: z
      .string()
      .min(1)
      .max(160)
      .regex(/^[A-Za-z0-9_-]+$/u)
      .optional(),
    previewBuildId: buildId.optional(),
    returnFrom: buildId.optional(),
    returnPage: z
      .string()
      .regex(/^[1-9][0-9]{0,3}$/u)
      .transform(Number)
      .refine((value) => value <= 1000)
      .optional(),
  })
  .strict();
export function resourceRequirementsQuery(
  params: URLSearchParams,
  scope: ResourceRequirementsScope,
) {
  const raw: Record<string, string> = {};
  for (const [key, value] of params) {
    if (key in raw) throw new AppError("Duplicate query", 400, "INVALID_REQUIREMENTS_QUERY");
    raw[key] = value;
  }
  const parsed = querySchema.safeParse(raw);
  if (
    !parsed.success ||
    (scope === "library" && parsed.data.buildId) ||
    (scope !== "library" &&
      (parsed.data.previewBuildId || parsed.data.returnFrom || parsed.data.returnPage)) ||
    (!parsed.data.previewBuildId && (parsed.data.returnFrom || parsed.data.returnPage)) ||
    (parsed.data.returnFrom === parsed.data.previewBuildId && parsed.data.returnFrom !== undefined)
  )
    throw new AppError("Invalid requirements query", 400, "INVALID_REQUIREMENTS_QUERY");
  return parsed.data;
}
