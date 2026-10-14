import { readBoundedJson, requireServerJsonContentType } from "./bounded-json";

export const AUTH_JSON_MAX_BODY_BYTES = 8 * 1024;

export async function readAuthJson(request: Request): Promise<unknown> {
  requireServerJsonContentType(request);
  try {
    return await readBoundedJson(request, AUTH_JSON_MAX_BODY_BYTES);
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 413) {
      throw new AppError("Authentication request body exceeds 8 KiB", 413, error.code);
    }
    throw error;
  }
}
import { AppError } from "@nexus/domain";
