import { safeExternalWebUrl } from "@nexus/validation";
/** Only this exact local handler can be an internal resource preview. */
export function safeResourceImageUrl(value: unknown): string | undefined {
  if (typeof value === "string" && /^\/api\/resource-media\/rmi_[A-Za-z0-9_-]{1,100}$/u.test(value))
    return value;
  return safeExternalWebUrl(value);
}
