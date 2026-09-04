import { zodToJsonSchema } from 'zod-to-json-schema';
import type { z } from 'zod';
import type { AutoParseableOutputFormat } from '@anthropic-ai/sdk';
import { LLMExtractionError } from './errors';

/** JSON Schema (draft 7, no `$ref`s) for a tool's `input_schema` or a structured-output format. */
export function toJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  return zodToJsonSchema(schema, { target: 'jsonSchema7', $refStrategy: 'none' }) as Record<string, unknown>;
}

/**
 * A zod-v3-compatible stand-in for `@anthropic-ai/sdk/helpers/zod`'s `zodOutputFormat`.
 *
 * That SDK helper calls zod v4's `z.toJSONSchema()` on the schema you pass it, which reads the
 * schema's internal `_zod` representation. `@tbd/shared`'s schemas are built with the classic
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
