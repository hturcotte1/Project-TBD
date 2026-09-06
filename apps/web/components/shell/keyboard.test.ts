import { describe, expect, it } from 'vitest';
import { isTypingContext } from './keyboard';

describe('isTypingContext', () => {
  it('is false for a plain element', () => {
    expect(isTypingContext(document.createElement('div'))).toBe(false);
  });

  it('is true for text inputs and textareas', () => {
    expect(isTypingContext(document.createElement('input'))).toBe(true);
    expect(isTypingContext(document.createElement('textarea'))).toBe(true);
  });

  it('is true for a contenteditable element', () => {
    const el = document.createElement('div');
    el.contentEditable = 'true';
    document.body.appendChild(el);
    expect(isTypingContext(el)).toBe(true);
    el.remove();
  });

  it('is true inside an open dialog', () => {
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    const child = document.createElement('span');
    dialog.appendChild(child);
    document.body.appendChild(dialog);
    expect(isTypingContext(child)).toBe(true);
    dialog.remove();
  });

  it('is false for null or non-element targets', () => {
    expect(isTypingContext(null)).toBe(false);
  });
});
