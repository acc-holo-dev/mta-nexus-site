import { type UserLibraryFilter, type UserLibraryPage, userLibraryRepository } from "@nexus/db";

export type { UserLibraryFilter, UserLibraryPage };

export const userLibraryService = {
  pageByUser(
    userId: string,
    page?: number,
    filter?: UserLibraryFilter,
    pageSize?: number,
    query?: string,
  ): Promise<UserLibraryPage> {
    return query === undefined && pageSize === undefined
      ? userLibraryRepository.pageByUser(userId, page, filter)
      : userLibraryRepository.pageByUser(userId, page, filter, pageSize, query);
  },
};
