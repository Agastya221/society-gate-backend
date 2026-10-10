import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import { findInSociety, clampPagination } from '../../utils/scope';
import type { Prisma, PostCategory } from '../../types';
import type { CreatePostInput, CreateCommentInput } from './community-post.schemas';

export class CommunityPostService {
  // ============================================
  // POSTS
  // ============================================

  async createPost(data: CreatePostInput, authorId: string, societyId: string, isAdmin = false) {
    const post = await prisma.communityPost.create({
      data: {
        title: data.title,
        content: data.content,
        category: data.category,
        isAnonymous: data.isAnonymous ?? false,
        // Pinning is an admin action; a resident's isPinned is ignored
        isPinned: isAdmin ? data.isPinned ?? false : false,
        authorId,
        societyId,
      },
      include: {
        author: { select: { id: true, name: true } },
      },
    });

    return this._formatPost(post, authorId);
  }

  async getPosts(filters: {
    societyId: string;
    category?: PostCategory;
    authorId?: string;
    requestingUserId: string;
    page?: number;
    limit?: number;
  }) {
    const { societyId, category, authorId, requestingUserId } = filters;
    const { page, limit, skip } = clampPagination(filters.page, filters.limit, 20);

    const where: Prisma.CommunityPostWhereInput = { societyId, isActive: true };
    if (category) where.category = category;
    if (authorId) {
      where.authorId = authorId;
      // Filtering by author must not reveal who wrote anonymous posts.
      if (authorId !== requestingUserId) where.isAnonymous = false;
    }

    const [posts, total] = await Promise.all([
      prisma.communityPost.findMany({
        where,
        include: {
          author: { select: { id: true, name: true } },
          likes: requestingUserId
            ? { where: { userId: requestingUserId }, select: { id: true } }
            : false,
        },
        orderBy: [
          { isPinned: 'desc' },
          { createdAt: 'desc' },
        ],
        skip,
        take: limit,
      }),
      prisma.communityPost.count({ where }),
    ]);

    return {
      posts: posts.map((p) => this._formatPost(p, requestingUserId)),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getPostById(postId: string, requestingUserId: string, societyId: string) {
    const post = await prisma.communityPost.findFirst({
      where: { id: postId, societyId, isActive: true },
      include: {
        author: { select: { id: true, name: true } },
        likes: { where: { userId: requestingUserId }, select: { id: true } },
      },
    });

    if (!post) throw new AppError('Post not found', 404);

    return this._formatPost(post, requestingUserId);
  }

  async deletePost(postId: string, userId: string, userRole: string, societyId: string) {
    const post = await findInSociety(prisma.communityPost, postId, societyId, {
      entity: 'Post',
      where: { isActive: true },
    });

    const isOwner = post.authorId === userId;
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(userRole);

    if (!isOwner && !isAdmin) {
      throw new AppError('You can only delete your own posts', 403);
    }

    await prisma.communityPost.update({
      where: { id: postId },
      data: { isActive: false },
    });

    return { message: 'Post deleted successfully' };
  }

  async togglePin(postId: string, societyId: string) {
    const post = await findInSociety(prisma.communityPost, postId, societyId, {
      entity: 'Post',
      where: { isActive: true },
    });

    const updated = await prisma.communityPost.update({
      where: { id: postId },
      data: { isPinned: !post.isPinned },
    });

    return updated;
  }

  async toggleLike(postId: string, userId: string, societyId: string) {
    const post = await findInSociety(prisma.communityPost, postId, societyId, {
      entity: 'Post',
      where: { isActive: true },
    });

    const existing = await prisma.postLike.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    if (existing) {
      await prisma.$transaction([
        prisma.postLike.delete({ where: { id: existing.id } }),
        prisma.communityPost.update({
          where: { id: postId },
          data: { likesCount: { decrement: 1 } },
        }),
      ]);
      return { liked: false, likesCount: Math.max(0, post.likesCount - 1) };
    } else {
      await prisma.$transaction([
        prisma.postLike.create({ data: { postId, userId } }),
        prisma.communityPost.update({
          where: { id: postId },
          data: { likesCount: { increment: 1 } },
        }),
      ]);
      return { liked: true, likesCount: post.likesCount + 1 };
    }
  }

  // ============================================
  // COMMENTS
  // ============================================

  async addComment(postId: string, data: CreateCommentInput, authorId: string, societyId: string) {
    await findInSociety(prisma.communityPost, postId, societyId, {
      entity: 'Post',
      where: { isActive: true },
    });

    const [comment] = await prisma.$transaction([
      prisma.postComment.create({
        data: {
          postId,
          content: data.content,
          isAnonymous: data.isAnonymous ?? false,
          authorId,
          societyId,
        },
        include: {
          author: { select: { id: true, name: true } },
        },
      }),
      prisma.communityPost.update({
        where: { id: postId },
        data: { commentsCount: { increment: 1 } },
      }),
    ]);

    return this._formatComment(comment, authorId);
  }

  async getComments(
    postId: string,
    societyId: string,
    requestingUserId: string,
    rawPage?: number,
    rawLimit?: number,
  ) {
    await findInSociety(prisma.communityPost, postId, societyId, {
      entity: 'Post',
      where: { isActive: true },
    });
    const { page, limit, skip } = clampPagination(rawPage, rawLimit, 30);

    const [comments, total] = await Promise.all([
      prisma.postComment.findMany({
        where: { postId },
        include: {
          author: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      prisma.postComment.count({ where: { postId } }),
    ]);

    return {
      comments: comments.map((c) => this._formatComment(c, requestingUserId)),
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  // ============================================
  // HELPERS
  // ============================================

  private _formatPost(
    post: {
      isAnonymous: boolean;
      author: { id: string; name: string } | null;
      likes?: { id: string }[];
      [key: string]: unknown;
    },
    requestingUserId: string
  ) {
    const { author, likes, authorId, ...rest } = post;
    // Anonymous posts must not leak who wrote them (authorId included), except to the author.
    const hideAuthor = post.isAnonymous && authorId !== requestingUserId;
    return {
      ...rest,
      ...(hideAuthor ? {} : { authorId }),
      author: post.isAnonymous ? null : author,
      isLikedByMe: (likes?.length ?? 0) > 0,
    };
  }

  private _formatComment(
    comment: {
      isAnonymous: boolean;
      author: { id: string; name: string } | null;
      [key: string]: unknown;
    },
    requestingUserId: string
  ) {
    const { author, authorId, ...rest } = comment;
    const hideAuthor = comment.isAnonymous && authorId !== requestingUserId;
    return {
      ...rest,
      ...(hideAuthor ? {} : { authorId }),
      author: comment.isAnonymous ? null : author,
    };
  }
}
