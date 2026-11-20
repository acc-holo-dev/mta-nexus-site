import { type UserLibraryFilter, type UserLibraryPage, userLibraryRepository } from "@nexus/db";

export type { UserLibraryFilter, UserLibraryPage };

export const userLibraryService = {
  pageByUser(
    userId: string,
    page?: number,
    filter?: UserLibraryFilter,
    pageSize?: number,
  ): Promise<UserLibraryPage> {
    return pageSize === undefined
      ? userLibraryRepository.pageByUser(userId, page, filter)
      : userLibraryRepository.pageByUser(userId, page, filter, pageSize);
  },
};
