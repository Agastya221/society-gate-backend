import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import type { Prisma, PostCategory } from '../../types';

export class CommunityPostService {
  // ============================================
  // POSTS
  // ============================================

  async createPost(data: {
    title: string;
    content: string;
    category?: PostCategory;
    isAnonymous?: boolean;
  }, authorId: string, societyId: string) {
    const post = await prisma.communityPost.create({
      data: {
        ...data,
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
    const { societyId, category, authorId, requestingUserId, page = 1, limit = 20 } = filters;

    const where: Prisma.CommunityPostWhereInput = { societyId, isActive: true };
    if (category) where.category = category;
    if (authorId) where.authorId = authorId;

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
        skip: (page - 1) * limit,
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

  async getPostById(postId: string, requestingUserId: string) {
    const post = await prisma.communityPost.findUnique({
      where: { id: postId },
      include: {
        author: { select: { id: true, name: true } },
        likes: { where: { userId: requestingUserId }, select: { id: true } },
      },
    });

    if (!post || !post.isActive) {
      throw new AppError('Post not found', 404);
    }

    return this._formatPost(post, requestingUserId);
  }

  async deletePost(postId: string, userId: string, userRole: string) {
    const post = await prisma.communityPost.findUnique({ where: { id: postId } });

    if (!post || !post.isActive) {
      throw new AppError('Post not found', 404);
    }

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

  async togglePin(postId: string) {
    const post = await prisma.communityPost.findUnique({ where: { id: postId } });

    if (!post) throw new AppError('Post not found', 404);

    const updated = await prisma.communityPost.update({
      where: { id: postId },
      data: { isPinned: !post.isPinned },
    });

    return updated;
  }

  async toggleLike(postId: string, userId: string) {
    const post = await prisma.communityPost.findUnique({ where: { id: postId } });
    if (!post || !post.isActive) throw new AppError('Post not found', 404);

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

  async addComment(postId: string, data: {
    content: string;
    isAnonymous?: boolean;
  }, authorId: string, societyId: string) {
    const post = await prisma.communityPost.findUnique({ where: { id: postId } });
    if (!post || !post.isActive) throw new AppError('Post not found', 404);

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

    return this._formatComment(comment);
  }

  async getComments(postId: string, page = 1, limit = 30) {
    const post = await prisma.communityPost.findUnique({ where: { id: postId } });
    if (!post || !post.isActive) throw new AppError('Post not found', 404);

    const [comments, total] = await Promise.all([
      prisma.postComment.findMany({
        where: { postId },
        include: {
          author: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.postComment.count({ where: { postId } }),
    ]);

    return {
      comments: comments.map(this._formatComment),
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
    const { author, likes, ...rest } = post;
    return {
      ...rest,
      author: post.isAnonymous ? null : author,
      isLikedByMe: (likes?.length ?? 0) > 0,
    };
  }

  private _formatComment(
    comment: {
      isAnonymous: boolean;
      author: { id: string; name: string } | null;
      [key: string]: unknown;
    }
  ) {
    const { author, ...rest } = comment;
    return {
      ...rest,
      author: comment.isAnonymous ? null : author,
    };
  }
}
