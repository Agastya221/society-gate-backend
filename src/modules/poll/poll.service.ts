import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import type { Prisma, PollStatus } from '../../types';

export class PollService {
  // ============================================
  // ADMIN — create / manage
  // ============================================

  async createPoll(data: {
    title: string;
    description?: string;
    isAnonymous?: boolean;
    allowMultiple?: boolean;
    votingEndsAt?: string;
    options: string[]; // option texts
  }, createdById: string, societyId: string) {
    if (!data.options || data.options.length < 2) {
      throw new AppError('Poll must have at least 2 options', 400);
    }

    const poll = await prisma.poll.create({
      data: {
        title: data.title,
        description: data.description,
        isAnonymous: data.isAnonymous ?? false,
        allowMultiple: data.allowMultiple ?? false,
        votingEndsAt: data.votingEndsAt ? new Date(data.votingEndsAt) : null,
        status: 'ACTIVE',
        createdById,
        societyId,
        options: {
          create: data.options.map((text) => ({ text })),
        },
      },
      include: {
        options: true,
        createdBy: { select: { id: true, name: true } },
      },
    });

    return poll;
  }

  async updatePoll(pollId: string, data: {
    title?: string;
    description?: string;
    status?: PollStatus;
    votingEndsAt?: string;
  }) {
    const poll = await prisma.poll.findUnique({ where: { id: pollId } });
    if (!poll) throw new AppError('Poll not found', 404);

    return prisma.poll.update({
      where: { id: pollId },
      data: {
        ...data,
        votingEndsAt: data.votingEndsAt ? new Date(data.votingEndsAt) : undefined,
      },
      include: { options: true },
    });
  }

  async deletePoll(pollId: string) {
    const poll = await prisma.poll.findUnique({ where: { id: pollId } });
    if (!poll) throw new AppError('Poll not found', 404);

    await prisma.poll.delete({ where: { id: pollId } });
    return { message: 'Poll deleted successfully' };
  }

  // ============================================
  // RESIDENT — list, detail, vote
  // ============================================

  async getPolls(filters: {
    societyId: string;
    status?: PollStatus;
    requestingUserId: string;
    page?: number;
    limit?: number;
  }) {
    const { societyId, status, requestingUserId, page = 1, limit = 20 } = filters;

    const where: Prisma.PollWhereInput = { societyId };
    if (status) where.status = status;

    // Auto-close expired polls
    await prisma.poll.updateMany({
      where: {
        societyId,
        status: 'ACTIVE',
        votingEndsAt: { lt: new Date() },
      },
      data: { status: 'CLOSED' },
    });

    const [polls, total] = await Promise.all([
      prisma.poll.findMany({
        where,
        include: {
          options: true,
          votes: { where: { votedById: requestingUserId }, select: { optionId: true } },
          createdBy: { select: { id: true, name: true } },
          _count: { select: { votes: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.poll.count({ where }),
    ]);

    return {
      polls: polls.map((p) => this._formatPoll(p)),
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async getPollById(pollId: string, requestingUserId: string) {
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: {
        options: true,
        votes: { where: { votedById: requestingUserId }, select: { optionId: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { votes: true } },
      },
    });

    if (!poll) throw new AppError('Poll not found', 404);

    return this._formatPoll(poll);
  }

  async castVote(pollId: string, optionId: string, votedById: string) {
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: { options: true },
    });

    if (!poll) throw new AppError('Poll not found', 404);
    if (poll.status !== 'ACTIVE') throw new AppError('This poll is no longer accepting votes', 400);
    if (poll.votingEndsAt && poll.votingEndsAt < new Date()) {
      throw new AppError('Voting period has ended', 400);
    }

    const optionExists = poll.options.some((o) => o.id === optionId);
    if (!optionExists) throw new AppError('Option not found in this poll', 400);

    // Check if already voted (unique constraint enforces this too)
    const existingVote = await prisma.pollVote.findUnique({
      where: { pollId_votedById: { pollId, votedById } },
    });

    if (existingVote) {
      if (!poll.allowMultiple) {
        throw new AppError('You have already voted in this poll', 400);
      }
      // For allowMultiple, changing vote: remove old, add new
      await prisma.$transaction([
        prisma.pollVote.delete({ where: { id: existingVote.id } }),
        prisma.pollOption.update({
          where: { id: existingVote.optionId },
          data: { votes: { decrement: 1 } },
        }),
        prisma.pollVote.create({ data: { pollId, optionId, votedById } }),
        prisma.pollOption.update({
          where: { id: optionId },
          data: { votes: { increment: 1 } },
        }),
      ]);
    } else {
      await prisma.$transaction([
        prisma.pollVote.create({ data: { pollId, optionId, votedById } }),
        prisma.pollOption.update({
          where: { id: optionId },
          data: { votes: { increment: 1 } },
        }),
      ]);
    }

    return this.getPollById(pollId, votedById);
  }

  // ============================================
  // HELPERS
  // ============================================

  private _formatPoll(poll: {
    isAnonymous: boolean;
    options: Array<{ id: string; text: string; votes: number }>;
    votes: Array<{ optionId: string }>;
    _count: { votes: number };
    [key: string]: unknown;
  }) {
    const { votes, _count, ...rest } = poll;
    const myVotedOptionId = votes.length > 0 ? votes[0].optionId : null;
    const totalVotes = _count.votes;

    return {
      ...rest,
      totalVotes,
      hasVoted: votes.length > 0,
      myVotedOptionId,
      // Show vote counts only if poll is not anonymous OR user has already voted
      options: rest.options as Array<{ id: string; text: string; votes: number }>,
    };
  }
}
