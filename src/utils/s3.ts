import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// S3 Client configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'society-gate-documents';
const UPLOAD_EXPIRY = parseInt(process.env.S3_UPLOAD_EXPIRY || '300', 10); // 5 minutes
const VIEW_EXPIRY = parseInt(process.env.S3_VIEW_EXPIRY || '3600', 10); // 1 hour

// Document folder structure
type FolderType = 'onboarding' | 'entry-photos' | 'general';

/**
 * Generate a unique S3 key for a file
 */
export function generateS3Key(
  folder: FolderType,
  userId: string,
  fileName: string
): string {
  const timestamp = Date.now();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${folder}/${userId}/${timestamp}-${sanitizedFileName}`;
}

/**
 * Get a pre-signed URL for uploading a file to S3
 */
export async function getPresignedUploadUrl(
  s3Key: string,
  contentType: string,
  expiresIn: number = UPLOAD_EXPIRY
): Promise<{ uploadUrl: string; s3Key: string }> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });

  return { uploadUrl, s3Key };
}

/**
 * Get a pre-signed URL for viewing/downloading a file from S3
 */
export async function getPresignedViewUrl(
  s3Key: string,
  expiresIn: number = VIEW_EXPIRY
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Delete a file from S3
 */
export async function deleteFromS3(s3Key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
  });

  await s3Client.send(command);
}

/**
 * Validate file type for uploads
 */
export function isValidFileType(
  mimeType: string,
  allowedTypes: string[]
): boolean {
  return allowedTypes.includes(mimeType);
}

// Allowed MIME types for different upload contexts
export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
];

export const ALLOWED_PHOTO_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

export { s3Client, BUCKET_NAME };
