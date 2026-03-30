import type { Request, Response } from 'express';
import { PollService } from './poll.service';
import { getErrorMessage, getErrorStatusCode } from '../../utils/errorHandler';
import type { PollStatus } from '../../types';

const pollService = new PollService();

export const createPoll = async (req: Request, res: Response) => {
  try {
    const poll = await pollService.createPoll(req.body, req.user!.id, req.user!.societyId!);
    res.status(201).json({ success: true, message: 'Poll created', data: poll });
  } catch (error) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const updatePoll = async (req: Request, res: Response) => {
  try {
    const poll = await pollService.updatePoll(String(req.params.id), req.body);
    res.status(200).json({ success: true, message: 'Poll updated', data: poll });
  } catch (error) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const deletePoll = async (req: Request, res: Response) => {
  try {
    const result = await pollService.deletePoll(String(req.params.id));
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const getPolls = async (req: Request, res: Response) => {
  try {
    const result = await pollService.getPolls({
      societyId: req.user!.societyId!,
      status: req.query.status as PollStatus | undefined,
      requestingUserId: req.user!.id,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const getPollById = async (req: Request, res: Response) => {
  try {
    const poll = await pollService.getPollById(String(req.params.id), req.user!.id);
    res.status(200).json({ success: true, data: poll });
  } catch (error) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const castVote = async (req: Request, res: Response) => {
  try {
    const { optionId } = req.body;
    if (!optionId) {
      return res.status(400).json({ success: false, message: 'optionId is required' });
    }
    const poll = await pollService.castVote(String(req.params.id), optionId as string, req.user!.id);
    res.status(200).json({ success: true, message: 'Vote cast successfully', data: poll });
  } catch (error) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};
