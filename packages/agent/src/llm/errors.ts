/** Thrown by LLMProvider.extract() when the model's structured output is missing or invalid. */
export class LLMExtractionError extends Error {
  constructor(
    readonly schemaName: string,
    reason: string,
  ) {
    super(`extraction failed for schema "${schemaName}": ${reason}`);
    this.name = 'LLMExtractionError';
  }
}
