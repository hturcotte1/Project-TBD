import { describe, expect, it } from 'vitest';
import { readFixture } from '../testing/fixtures';
import { detectPageState } from './pageState';

describe('detectPageState', () => {
  it('recognizes a plain login page', () => {
    expect(detectPageState(readFixture('login'))).toBe('login');
  });
  it('recognizes a login page with an error banner', () => {
    expect(detectPageState(readFixture('login_error'))).toBe('login');
  });
  it('recognizes a verification page', () => {
    expect(detectPageState(readFixture('verification'))).toBe('verification');
  });
  it('recognizes a maintenance page', () => {
    expect(detectPageState(readFixture('maintenance'))).toBe('maintenance');
  });
  it('recognizes an authenticated page', () => {
    expect(detectPageState(readFixture('dashboard'))).toBe('logged_in');
    expect(detectPageState(readFixture('my_colleges'))).toBe('logged_in');
  });
  it('falls back to unknown for unrecognized content', () => {
    expect(detectPageState('<html><body><p>hello</p></body></html>')).toBe('unknown');
  });
});
