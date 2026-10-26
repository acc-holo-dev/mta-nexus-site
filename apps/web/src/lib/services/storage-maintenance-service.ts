import { storageMaintenanceRepository } from "@nexus/db";
import { AppError, type StorageRemovalResult } from "@nexus/domain";
import { getStorageProvider } from "@nexus/storage";
export const storageMaintenanceService = {
  list: storageMaintenanceRepository.list.bind(storageMaintenanceRepository),
  detail: storageMaintenanceRepository.detail.bind(storageMaintenanceRepository),
  async namespaces(actorId: string, offset: number, signal?: AbortSignal) {
    await storageMaintenanceRepository.assertAdmin(actorId);
    const provider = getStorageProvider();
    if (!provider.listAssetNamespaces)
      throw new AppError("Unsupported storage maintenance", 503, "STORAGE_MAINTENANCE_UNSUPPORTED");
    return provider.listAssetNamespaces(offset, signal);
  },
  async discover(actorId: string, currentToken: string, ownerId: string, offset: number, signal?: AbortSignal) {
    await storageMaintenanceRepository.assertAdmin(actorId);
    const provider = getStorageProvider();
    if (!provider.discoverAssetNamespace)
      throw new AppError("Unsupported storage maintenance", 503, "STORAGE_MAINTENANCE_UNSUPPORTED");
    const page = await provider.discoverAssetNamespace(
      ownerId,
      offset,
      signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
    );
    signal?.throwIfAborted();
    const result = await storageMaintenanceRepository.observe(actorId, currentToken, page.objects);
    return { ...result, skipped: page.skipped, nextOffset: page.nextOffset, limited: page.limited };
  },
  async cleanup(actorId: string, currentToken: string, id: string, expectedRevision: number) {
    await storageMaintenanceRepository.assertAdmin(actorId);
    const provider = getStorageProvider();
    if (!provider.removeMaintenanceObject)
      throw new AppError("Unsupported storage maintenance", 503, "STORAGE_MAINTENANCE_UNSUPPORTED");
    const job = await storageMaintenanceRepository.retire(actorId, currentToken, id, expectedRevision);
    if (job.terminal) return { state: job.state };
    // Request cancellation after retirement must not interrupt recording the outcome.
    let result: StorageRemovalResult | "failed";
    try {
      result = await provider.removeMaintenanceObject(job.identity, id, AbortSignal.timeout(30000));
    } catch {
      result = "failed";
    }
    return storageMaintenanceRepository.finish(actorId, id, job.leaseToken, result);
  },
};
