/** Gallery positions are independent of resource files, licenses and access grants. */
export const RESOURCE_MEDIA_LIMIT = 8;
export const RESOURCE_MEDIA_INPUT_BYTES = 5 * 1024 * 1024;
export const RESOURCE_MEDIA_OUTPUT_BYTES = 4 * 1024 * 1024;
export type ResourceMediaItem = {
  id: string;
  caption: string;
  position: number;
  width: number;
  height: number;
  url: string;
};
export type ManagedResourceMedia = {
  product: { id: string; title: string; status: string; updatedAt: string };
  items: ResourceMediaItem[];
};
export function resourceMediaUrl(id: string): string {
  return `/api/resource-media/${encodeURIComponent(id)}`;
}
