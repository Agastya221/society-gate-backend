import type { Response, Request } from 'express';
import { UploadService } from './upload.service';

const uploadService = new UploadService();

/**
 * Get a pre-signed URL for uploading a file
 */
export const getPresignedUrl = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
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
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to generate upload URL',
    });
  }
};

/**
 * Confirm upload and save document metadata
 */
export const confirmUpload = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
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
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to confirm upload',
    });
  }
};

/**
 * Get a pre-signed view URL for a document
 */
export const getViewUrl = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const viewUrl = await uploadService.getViewUrl(id, userId);

    res.status(200).json({
      success: true,
      data: { viewUrl },
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to generate view URL',
    });
  }
};

/**
 * Delete a document
 */
export const deleteDocument = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    await uploadService.deleteDocument(id, userId);

    res.status(200).json({
      success: true,
      message: 'Document deleted successfully',
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to delete document',
    });
  }
};

/**
 * Get a pre-signed view URL for entry request photo
 */
export const getEntryPhotoViewUrl = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const viewUrl = await uploadService.getEntryPhotoViewUrl(id, userId);

    res.status(200).json({
      success: true,
      data: { viewUrl },
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to generate photo URL',
    });
  }
};
