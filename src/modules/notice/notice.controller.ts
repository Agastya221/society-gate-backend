import type { Response, Request } from 'express';
import { NoticeService } from './notice.service';
import type { NoticeFilters, NoticeType, NoticePriority } from '../../types';
import { getSocietyId } from '../../utils/scope';
import { getErrorMessage, getErrorStatusCode } from '../../utils/errorHandler';

const noticeService = new NoticeService();

export const createNotice = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const notice = await noticeService.createNotice(req.body, userId, getSocietyId(req));

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
    const isAdmin = req.user!.role === 'ADMIN' || req.user!.role === 'SUPER_ADMIN';
    const filters: NoticeFilters = {
      societyId: getSocietyId(req),
      type: req.query.type as NoticeType | undefined,
      priority: req.query.priority as NoticePriority | undefined,
      isPinned: req.query.isPinned === 'true' ? true : req.query.isPinned === 'false' ? false : undefined,
      // Only admins may list deactivated notices; everyone else always gets active ones
      isActive: isAdmin
        ? (req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined)
        : true,
      // Expired notices are only ever listed for admins who explicitly ask (?includeExpired=true)
      includeExpired: req.query.includeExpired === 'true' && isAdmin,
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
    const notice = await noticeService.getNoticeById(
      id,
      getSocietyId(req),
      req.user!.role === 'ADMIN' || req.user!.role === 'SUPER_ADMIN'
    );

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
    const notice = await noticeService.updateNotice(id, req.body, userId, getSocietyId(req));

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
    const result = await noticeService.deleteNotice(id, userId, getSocietyId(req));

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
    const notice = await noticeService.togglePinNotice(id, getSocietyId(req));

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
