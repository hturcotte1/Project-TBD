import { describe, expect, it } from 'vitest';
import { parseDotEnv } from './dotenv';

describe('parseDotEnv', () => {
  it('parses keys, quotes, comments, and export prefixes', () => {
    const parsed = parseDotEnv(`# comment\nA=1\nexport B="two words"\nC='x' \nD=value # trailing\n\nBAD LINE\n=nokey\n`);
    expect(parsed).toEqual({ A: '1', B: 'two words', C: 'x', D: 'value' });
  });
});
