import { z } from "zod";

// MTA's sortable release form, for example 1.6.0-9.22279.0.
export const MTA_VERSION_PATTERN = /^1\.\d+(?:\.\d+)?(?:-\d+(?:\.\d+){1,2})?$/;
export const mtaVersionSchema = z
  .string()
  .max(64)
  .regex(MTA_VERSION_PATTERN, "Use an MTA version such as 1.6.0 or 1.6.0-9.22279.0");
