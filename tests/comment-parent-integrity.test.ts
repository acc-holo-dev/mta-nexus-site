import { beforeAll, describe, expect, it } from "vitest";
import { contentRepository, userRepository } from "@nexus/db";
import type { Content, User } from "@nexus/domain";

describe("comment parent database integrity", () => {
  const suffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  let author: User;
  let firstArticle: Content;
  let secondArticle: Content;

  beforeAll(async () => {
    author = await userRepository.create({
      id: `usr_comment_integrity_${suffix}`,
      email: `comment_integrity_${suffix}@nexus.test`,
      username: `comment_integrity_${suffix}`,
      displayName: "Comment Integrity Tester",
    });

    const createArticle = (id: string, slug: string) =>
      contentRepository.create({
        id,
        title: slug,
        slug,
        body: "Database integrity test content",
        type: "article",
        authorId: author.id,
        status: "published",
        viewCount: 0,
        likeCount: 0,
        commentCount: 0,
        tags: [],
        publishedAt: new Date(),
      });

    firstArticle = await createArticle(
      `cnt_comment_parent_a_${suffix}`,
      `comment-parent-a-${suffix}`
    );
    secondArticle = await createArticle(
      `cnt_comment_parent_b_${suffix}`,
      `comment-parent-b-${suffix}`
    );
  });

  it("rejects a reply whose parent belongs to another article", async () => {
    const parent = await contentRepository.addComment({
      id: `cmt_comment_parent_${suffix}`,
      contentId: firstArticle.id,
      authorId: author.id,
      text: "Parent comment",
      isVerifiedPurchase: false,
    });

    await expect(
      contentRepository.addComment({
        id: `cmt_comment_reply_${suffix}`,
        contentId: secondArticle.id,
        parentId: parent.id,
        authorId: author.id,
        text: "Cross-article reply",
        isVerifiedPurchase: false,
      })
    ).rejects.toBeDefined();

    expect(await contentRepository.listComments({ contentId: secondArticle.id })).toEqual([]);
    expect((await contentRepository.findById(secondArticle.id))?.commentCount).toBe(0);
  });
});
