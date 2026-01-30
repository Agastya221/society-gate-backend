import type { Response, Request } from 'express';
import { UploadService } from './upload.service';
import { getErrorMessage, getErrorStatusCode } from '../../utils/errorHandler';

const uploadService = new UploadService();

/**
 * Get a pre-signed URL for uploading a file
 */
export const getPresignedUrl = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { context, fileName, mimeType, fileSize, documentType } = req.body;

    if (!context || !fileName || !mimeType || !fileSize) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: context, fileName, mimeType, fileSize',
      });
    }

    const result = await uploadService.getPresignedUrl(
      { context, fileName, mimeType, fileSize, documentType },
      userId
    );

    res.status(200).json({
      success: true,
      message: 'Pre-signed upload URL generated',
      data: result,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

/**
 * Confirm upload and save document metadata
 */
export const confirmUpload = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { s3Key, fileName, mimeType, fileSize, documentType, onboardingRequestId } =
      req.body;

    if (!s3Key || !fileName || !mimeType || !fileSize || !documentType) {
      return res.status(400).json({
        success: false,
        message:
          'Missing required fields: s3Key, fileName, mimeType, fileSize, documentType',
      });
    }

    const document = await uploadService.confirmUpload(
      { s3Key, fileName, mimeType, fileSize, documentType, onboardingRequestId },
      userId
    );

    res.status(201).json({
      success: true,
      message: 'Document uploaded successfully',
      data: document,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

/**
 * Get a pre-signed view URL for a document
 */
export const getViewUrl = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const viewUrl = await uploadService.getViewUrl(String(id), userId);

    res.status(200).json({
      success: true,
      data: { viewUrl },
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

/**
 * Delete a document
 */
export const deleteDocument = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    await uploadService.deleteDocument(String(id), userId);

    res.status(200).json({
      success: true,
      message: 'Document deleted successfully',
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

/**
 * Get a pre-signed view URL for entry request photo
 */
export const getEntryPhotoViewUrl = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const viewUrl = await uploadService.getEntryPhotoViewUrl(String(id), userId);

    res.status(200).json({
      success: true,
      data: { viewUrl },
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};
