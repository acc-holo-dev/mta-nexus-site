import { supportCaseRepository } from "@nexus/db";

/** Named support-case commands for HTTP handlers (OPS-01 / ARC02). */
export const supportCaseService = {
  pageByRequester: supportCaseRepository.pageByRequester.bind(supportCaseRepository),
  pageStaff: supportCaseRepository.pageStaff.bind(supportCaseRepository),
  findById: supportCaseRepository.findById.bind(supportCaseRepository),
  authorizedThread: supportCaseRepository.authorizedThread.bind(supportCaseRepository),
  findMutationReplay: supportCaseRepository.findMutationReplay.bind(supportCaseRepository),
  createIdempotentCase: supportCaseRepository.createIdempotentCase.bind(supportCaseRepository),
  addIdempotentMessage: supportCaseRepository.addIdempotentMessage.bind(supportCaseRepository),
  updateStatus: supportCaseRepository.updateStatus.bind(supportCaseRepository),
};
