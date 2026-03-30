import type { Request, Response } from 'express';
import { CommunityPostService } from './community-post.service';
import { getErrorMessage, getErrorStatusCode } from '../../utils/errorHandler';
import type { PostCategory } from '../../types';

const postService = new CommunityPostService();

export const createPost = async (req: Request, res: Response) => {
  try {
    const post = await postService.createPost(req.body, req.user!.id, req.user!.societyId!);
    res.status(201).json({ success: true, message: 'Post created', data: post });
  } catch (error) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const getPosts = async (req: Request, res: Response) => {
  try {
    const result = await postService.getPosts({
      societyId: req.user!.societyId!,
      category: req.query.category as PostCategory | undefined,
      authorId: req.query.authorId as string | undefined,
      requestingUserId: req.user!.id,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const getPostById = async (req: Request, res: Response) => {
  try {
    const post = await postService.getPostById(String(req.params.id), req.user!.id);
    res.status(200).json({ success: true, data: post });
  } catch (error) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const deletePost = async (req: Request, res: Response) => {
  try {
    const result = await postService.deletePost(String(req.params.id), req.user!.id, req.user!.role);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const togglePin = async (req: Request, res: Response) => {
  try {
    const post = await postService.togglePin(String(req.params.id));
    res.status(200).json({ success: true, message: `Post ${post.isPinned ? 'pinned' : 'unpinned'}`, data: post });
  } catch (error) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const likePost = async (req: Request, res: Response) => {
  try {
    const result = await postService.toggleLike(String(req.params.id), req.user!.id);
    res.status(200).json({ success: true, message: result.liked ? 'Post liked' : 'Post unliked', data: result });
  } catch (error) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const addComment = async (req: Request, res: Response) => {
  try {
    const comment = await postService.addComment(
      String(req.params.id),
      req.body,
      req.user!.id,
      req.user!.societyId!
    );
    res.status(201).json({ success: true, message: 'Comment added', data: comment });
  } catch (error) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const getComments = async (req: Request, res: Response) => {
  try {
    const result = await postService.getComments(
      String(req.params.id),
      req.query.page ? Number(req.query.page) : undefined,
      req.query.limit ? Number(req.query.limit) : undefined,
    );
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};
