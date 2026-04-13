import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { validateTargetSize, loadTargetSize, saveTargetSize } from '../utils/targetSize';
import { MIN_TARGET_KB, MAX_TARGET_KB } from '../constants';

describe('Feature: image-compressor, Property 3: Target size localStorage round trip', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  /**
   * **Validates: Requirements 2.3**
   *
   * For any valid integer between 10 and 10000,
   * saving it to localStorage and then loading it should return the same value.
   */
  it('round-trips any valid integer target size through localStorage', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MIN_TARGET_KB, max: MAX_TARGET_KB }),
        (targetSize) => {
          localStorage.clear();
          saveTargetSize(targetSize);
          const loaded = loadTargetSize();
          expect(loaded).toBe(targetSize);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Feature: image-compressor, Property 4: Target size validation rejects invalid inputs', () => {
  /**
   * **Validates: Requirements 2.4, 2.5**
   *
   * For any non-numeric string or number outside 10–10000,
   * validateTargetSize returns { valid: false } with an error message.
   */
  it('rejects non-numeric strings', () => {
    const nonNumericString = fc
      .string({ minLength: 1, maxLength: 50 })
      .filter((s) => {
        const n = Number(s.trim());
        return isNaN(n) || !isFinite(n);
      });

    fc.assert(
      fc.property(nonNumericString, (input) => {
        const result = validateTargetSize(input);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      }),
      { numRuns: 100 },
    );
  });

  it('rejects empty strings and whitespace-only strings', () => {
    const emptyOrWhitespace = fc.oneof(
      fc.constant(''),
      fc.integer({ min: 1, max: 10 }).map((n) => ' '.repeat(n)),
      fc.integer({ min: 1, max: 5 }).map((n) => '\t'.repeat(n)),
    );

    fc.assert(
      fc.property(emptyOrWhitespace, (input) => {
        const result = validateTargetSize(input);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      }),
      { numRuns: 100 },
    );
  });

  it('rejects numbers below the minimum (< 10)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e9, max: MIN_TARGET_KB - 0.001, noNaN: true }),
        (num) => {
          const result = validateTargetSize(String(num));
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rejects numbers above the maximum (> 10000)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: MAX_TARGET_KB + 0.001, max: 1e9, noNaN: true }),
        (num) => {
          const result = validateTargetSize(String(num));
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
        },
      ),
      { numRuns: 100 },
    );
  });
});
