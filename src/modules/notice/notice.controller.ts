import type { Response, Request } from 'express';
import { NoticeService } from './notice.service';

const noticeService = new NoticeService();

export const createNotice = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const notice = await noticeService.createNotice(req.body, userId);

    res.status(201).json({
      success: true,
      message: 'Notice created successfully',
      data: notice,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to create notice',
    });
  }
};

export const getNotices = async (req: Request, res: Response) => {
  try {
    const filters = req.query;
    const result = await noticeService.getNotices(filters);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to fetch notices',
    });
  }
};

export const getNoticeById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const notice = await noticeService.getNoticeById(id);

    res.status(200).json({
      success: true,
      data: notice,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to fetch notice',
    });
  }
};

export const updateNotice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;
    const notice = await noticeService.updateNotice(id, req.body, userId);

    res.status(200).json({
      success: true,
      message: 'Notice updated successfully',
      data: notice,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to update notice',
    });
  }
};

export const deleteNotice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;
    const result = await noticeService.deleteNotice(id, userId);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to delete notice',
    });
  }
};

export const togglePinNotice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const notice = await noticeService.togglePinNotice(id);

    res.status(200).json({
      success: true,
      message: 'Notice pin status updated',
      data: notice,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to toggle pin status',
    });
  }
};
