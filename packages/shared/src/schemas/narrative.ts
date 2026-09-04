import { z } from 'zod';

export const NarrativeTheme = z.object({
  title: z.string().max(120),
  description: z.string().max(600),
  evidence: z.array(z.string().max(300)).default([]),
});
export const NarrativeStory = z.object({
  title: z.string().max(120),
  summary: z.string().max(800),
  details: z.string().max(3000).default(''),
  what_it_changed: z.string().max(800).default(''),
  themes: z.array(z.string().max(120)).default([]),
  fits_prompts: z.array(z.string().max(200)).default([]),
});
export const NarrativeValue = z.object({ name: z.string().max(80), why: z.string().max(500) });
export const VoiceNotes = z.object({
  sentence_style: z.string().max(300).default(''),
  humor: z.string().max(300).default(''),
  vocabulary: z.string().max(300).default(''),
  samples: z.array(z.string().max(400)).max(8).default([]),
});

/** The output of the intangibles interview. Every later agent call receives this as context. */
export const StudentNarrative = z.object({
  themes: z.array(NarrativeTheme).default([]),
  stories: z.array(NarrativeStory).default([]),
  values: z.array(NarrativeValue).default([]),
  voice_notes: VoiceNotes.default({}),
  cares_about: z.string().max(1000).default(''),
  wants_to_do: z.string().max(1000).default(''),
  free_saturday: z.string().max(600).default(''),
  proud_of_not_on_resume: z.string().max(800).default(''),
  home_vs_school: z.string().max(800).default(''),
  family_context: z.string().max(1000).default(''),
  anxieties: z.string().max(800).default(''),
  summary: z.string().max(3000).default(''),
});
export type StudentNarrative = z.infer<typeof StudentNarrative>;
