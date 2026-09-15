import { config } from "@nexus/config";
import type { StorageProvider } from "./types";
import { LocalStorageProvider } from "./local-provider";

let instance: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (instance) return instance;

  if (config.STORAGE_PROVIDER === "local") {
    instance = new LocalStorageProvider(config.STORAGE_LOCAL_PATH);
  } else {
    // S3 fallback to local or mocked S3 provider
    instance = new LocalStorageProvider(config.STORAGE_LOCAL_PATH);
  }

  return instance;
}

export * from "./types";
export * from "./local-provider";
