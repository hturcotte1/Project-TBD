/** Content types the system accepts for uploaded/inbound documents, and their file extension. */
export const EXT_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/heic': 'heic',
};

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
