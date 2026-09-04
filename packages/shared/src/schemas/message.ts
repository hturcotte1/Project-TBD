import { z } from 'zod';

export const MediaRef = z.object({
  storage_key: z.string().max(500),
  content_type: z.string().max(100),
  document_id: z.string().uuid().nullable().default(null),
  /** Public or signed URL if one exists (outbound media must be fetchable by the provider). */
  url: z.string().max(1000).nullable().default(null),
  filename: z.string().max(200).nullable().default(null),
});
export type MediaRef = z.infer<typeof MediaRef>;
