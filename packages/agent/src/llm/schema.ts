import { zodToJsonSchema } from 'zod-to-json-schema';
import type { z } from 'zod';
import type { AutoParseableOutputFormat } from '@anthropic-ai/sdk';
import { LLMExtractionError } from './errors';

/**
 * `LLMExtractRequest<T>.schema` is typed `z.ZodType<T>`, whose `Input` type parameter defaults to
 * `T` itself (fully required). Every schema in `@apogee/shared/schemas` leans on `.default()` for
 * most fields, so its real Input type is narrower than its Output type `T` — TS then refuses the
 * assignment even though `.parse`/`.safeParse` behave exactly as expected at runtime. This cast
 * only affects the type-level `Input` parameter; it changes nothing about how the schema parses.
 */
export function forExtraction<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>): z.ZodType<T> {
  return schema as unknown as z.ZodType<T>;
}

/** JSON Schema (draft 7, no `$ref`s) for a tool's `input_schema` or a structured-output format. */
export function toJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  return zodToJsonSchema(schema, { target: 'jsonSchema7', $refStrategy: 'none' }) as Record<string, unknown>;
}

/**
 * A zod-v3-compatible stand-in for `@anthropic-ai/sdk/helpers/zod`'s `zodOutputFormat`.
 *
 * That SDK helper calls zod v4's `z.toJSONSchema()` on the schema you pass it, which reads the
 * schema's internal `_zod` representation. `@apogee/shared`'s schemas are built with the classic
 * "zod" package (v3.25, the default `zod` export — see `packages/shared/package.json`), whose
 * schema objects use the older `_def` representation and are not `instanceof` zod v4's `ZodType`.
 * Calling the SDK helper on them throws at runtime. `zod-to-json-schema` (already a dependency
 * here, and itself typed against `zod/v3`) produces the same JSON Schema from a v3 schema, so
 * this builds the identical `{ type: 'json_schema', schema, parse }` shape by hand instead.
 */
export function structuredOutputFormat<T>(schema: z.ZodType<T>, schemaName: string): AutoParseableOutputFormat<T> {
  const jsonSchema = toJsonSchema(schema);
  return {
    type: 'json_schema',
    schema: jsonSchema,
    parse: (content: string): T => {
      let raw: unknown;
      try {
        raw = JSON.parse(content);
      } catch (err) {
        throw new LLMExtractionError(schemaName, `model output was not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
      }
      const result = schema.safeParse(raw);
      if (!result.success) {
        const issues = result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
        throw new LLMExtractionError(schemaName, issues);
      }
      return result.data;
    },
  };
}
