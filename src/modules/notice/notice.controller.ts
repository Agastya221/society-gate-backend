import type { Response, Request } from 'express';
import { NoticeService } from './notice.service';
import type { NoticeFilters, NoticeType, NoticePriority } from '../../types';

const noticeService = new NoticeService();

// Helper to safely get error message
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred';
}

function getErrorStatusCode(error: unknown): number {
  if (error && typeof error === 'object' && 'statusCode' in error) {
    return (error as { statusCode: number }).statusCode;
  }
  return 500;
}

export const createNotice = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const notice = await noticeService.createNotice(req.body, userId);

    res.status(201).json({
      success: true,
      message: 'Notice created successfully',
      data: notice,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const getNotices = async (req: Request, res: Response) => {
  try {
    const filters: NoticeFilters = {
      societyId: req.user!.societyId!,
      type: req.query.type as NoticeType | undefined,
      priority: req.query.priority as NoticePriority | undefined,
      isPinned: req.query.isPinned === 'true' ? true : req.query.isPinned === 'false' ? false : undefined,
      isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
      page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
    };
    const result = await noticeService.getNotices(filters);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const getNoticeById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const notice = await noticeService.getNoticeById(id);

    res.status(200).json({
      success: true,
      data: notice,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const updateNotice = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    const notice = await noticeService.updateNotice(id, req.body, userId);

    res.status(200).json({
      success: true,
      message: 'Notice updated successfully',
      data: notice,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const deleteNotice = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    const result = await noticeService.deleteNotice(id, userId);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const togglePinNotice = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const notice = await noticeService.togglePinNotice(id);

    res.status(200).json({
      success: true,
      message: 'Notice pin status updated',
      data: notice,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};
