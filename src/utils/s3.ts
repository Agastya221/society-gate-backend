import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';

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

// Document folder structure. Every key is `<folder>/<ownerId>/<random>.<ext>`:
// the server picks the whole key, and the ownerId segment ties it to the uploader
// (or, for 'societies', to the society) so attach endpoints can verify ownership.
export type FolderType = 'onboarding' | 'entry-photos' | 'staff-photos' | 'general' | 'societies';

const MIME_EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function safeExtension(fileName: string, mimeType?: string): string {
  if (mimeType && MIME_EXTENSIONS[mimeType]) return MIME_EXTENSIONS[mimeType];
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  return /^[a-z0-9]{1,5}$/.test(ext) && ext !== fileName.toLowerCase() ? ext : 'bin';
}

/**
 * Generate a unique, unguessable S3 key for a file. The client's file name is
 * only used for its extension (when no known mimeType is given) — never as a path.
 */
export function generateS3Key(
  folder: FolderType,
  ownerId: string,
  fileName: string,
  mimeType?: string
): string {
  const safeOwner = String(ownerId).replace(/[^a-zA-Z0-9-]/g, '');
  if (!safeOwner) throw new Error('generateS3Key: ownerId is required');
  return `${folder}/${safeOwner}/${crypto.randomUUID()}.${safeExtension(fileName, mimeType)}`;
}

/**
 * True when `s3Key` is a key we issued under `<folder>/<ownerId>/` for one of the
 * given folders: no traversal, no nested path, nothing outside that prefix.
 * Use before storing/presigning any key that came back from a client.
 */
export function isOwnedUploadKey(
  s3Key: unknown,
  ownerId: string,
  folders: FolderType[]
): s3Key is string {
  if (typeof s3Key !== 'string' || !ownerId || s3Key.length > 512) return false;
  if (s3Key.includes('..') || s3Key.includes('//') || s3Key.includes('\\')) return false;
  return folders.some((folder) => {
    const prefix = `${folder}/${ownerId}/`;
    if (!s3Key.startsWith(prefix)) return false;
    const rest = s3Key.slice(prefix.length);
    return rest.length > 0 && !rest.includes('/');
  });
}

/**
 * Get a pre-signed URL for uploading a file to S3.
 * When `contentLength` is given it is signed into the URL (along with the
 * content type), so S3 rejects a body of any other size or type.
 */
export async function getPresignedUploadUrl(
  s3Key: string,
  contentType: string,
  expiresIn: number = UPLOAD_EXPIRY,
  contentLength?: number
): Promise<{ uploadUrl: string; s3Key: string }> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
    ContentType: contentType,
    ...(contentLength !== undefined ? { ContentLength: contentLength } : {}),
  });

  const uploadUrl = await getSignedUrl(s3Client, command, {
    expiresIn,
    ...(contentLength !== undefined
      ? { signableHeaders: new Set(['content-type', 'content-length']) }
      : {}),
  });

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

// Upload size limits (bytes)
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export { s3Client, BUCKET_NAME };
