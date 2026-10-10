import type { Request, Response } from 'express';
import { DocumentService } from './document.service';
import { getSocietyId } from '../../utils/scope';
import { getErrorMessage, getErrorStatusCode } from '../../utils/errorHandler';
import type { DocumentCategory } from '../../types';

const documentService = new DocumentService();

// Only society admins may publish society-wide (admin) documents.
const canPublish = (req: Request) => ['ADMIN', 'SUPER_ADMIN'].includes(req.user!.role);

export const getUploadUrl = async (req: Request, res: Response) => {
  try {
    const result = await documentService.getUploadUrl(
      { ...req.body, isAdminDoc: canPublish(req) ? req.body.isAdminDoc : false },
      req.user!.id
    );
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const confirmUpload = async (req: Request, res: Response) => {
  try {
    const document = await documentService.confirmUpload(
      { ...req.body, isAdminDoc: canPublish(req) ? req.body.isAdminDoc : false },
      req.user!.id,
      getSocietyId(req)
    );
    res.status(201).json({ success: true, message: 'Document saved', data: document });
  } catch (error) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const getDocuments = async (req: Request, res: Response) => {
  try {
    const result = await documentService.getDocuments({
      societyId: getSocietyId(req),
      requestingUserId: req.user!.id,
      category: req.query.category as DocumentCategory | undefined,
      isAdminDoc: req.query.isAdminDoc === 'true' ? true : req.query.isAdminDoc === 'false' ? false : undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const getViewUrl = async (req: Request, res: Response) => {
  try {
    const result = await documentService.getViewUrl(String(req.params.id), req.user!.id, req.user!.role, getSocietyId(req));
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const deleteDocument = async (req: Request, res: Response) => {
  try {
    const result = await documentService.deleteDocument(String(req.params.id), req.user!.id, req.user!.role, getSocietyId(req));
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};
