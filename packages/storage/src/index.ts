import { config } from "@nexus/config";
import type { StorageProvider } from "./types";
import { LocalStorageProvider } from "./local-provider";

let instance: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (instance) return instance;

  if (config.STORAGE_PROVIDER === "local") {
    instance = new LocalStorageProvider(config.STORAGE_LOCAL_PATH);
    return instance;
  }

  throw new Error(
    "S3 storage is configured but no S3 adapter is installed. Refusing to fall back to local storage."
  );
}

export * from "./types";
export * from "./local-provider";
export * from "./storage-service";
