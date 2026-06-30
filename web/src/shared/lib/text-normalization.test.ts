import { describe, expect, it } from 'vitest';
import { normalizeText } from './text-normalization';

describe('normalizeText', () => {
  it('converts a LaTeX right arrow to Unicode', () => {
    expect(normalizeText("'By the time' + thì hiện tại đơn $\\rightarrow$ 'have eaten'"))
      .toBe("'By the time' + thì hiện tại đơn → 'have eaten'");
  });

  it('converts every matching arrow in the same string', () => {
    expect(normalizeText('A $\\rightarrow$ B $\\rightarrow$ C')).toBe('A → B → C');
  });

  it('converts a right arrow damaged by JSON carriage-return decoding', () => {
    expect(normalizeText("Không thích bất kỳ rau nào $ ightarrow$ 'any'"))
      .toBe("Không thích bất kỳ rau nào → 'any'");
    expect(normalizeText('A $\rightarrow$ B')).toBe('A → B');
  });

  it('keeps text without LaTeX arrows unchanged', () => {
    expect(normalizeText('Giải thích Socratic')).toBe('Giải thích Socratic');
  });

  it('keeps an existing Unicode arrow unchanged', () => {
    expect(normalizeText('A → B')).toBe('A → B');
  });
});
