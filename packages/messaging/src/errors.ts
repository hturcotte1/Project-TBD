/** Thrown by any MessagingProvider when a vendor call fails after retries. */
export interface MessagingErrorOptions {
  status: number;
  body: string;
  retryable: boolean;
}

export class MessagingError extends Error {
  readonly status: number;
  readonly body: string;
  readonly retryable: boolean;

  constructor(opts: MessagingErrorOptions) {
    super(`messaging provider request failed with status ${opts.status}`);
    this.name = 'MessagingError';
    this.status = opts.status;
    this.body = opts.body;
    this.retryable = opts.retryable;
  }
}
