/** Injectable clock so proactive timing logic can be tested deterministically. */
export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class FixedClock implements Clock {
  private current: Date;
  constructor(at: Date | string) {
    this.current = typeof at === 'string' ? new Date(at) : new Date(at.getTime());
  }
  now(): Date {
    return new Date(this.current.getTime());
  }
  set(at: Date | string): void {
    this.current = typeof at === 'string' ? new Date(at) : new Date(at.getTime());
  }
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}
