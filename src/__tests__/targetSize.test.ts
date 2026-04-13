import { describe, it, expect, beforeEach } from 'vitest';
import { validateTargetSize, loadTargetSize, saveTargetSize } from '../utils/targetSize';

describe('validateTargetSize', () => {
  it('returns valid for a number within range', () => {
    const result = validateTargetSize('400');
    expect(result).toEqual({ valid: true, kb: 400 });
  });

  it('returns valid for the minimum boundary (10)', () => {
    const result = validateTargetSize('10');
    expect(result).toEqual({ valid: true, kb: 10 });
  });

  it('returns valid for the maximum boundary (10000)', () => {
    const result = validateTargetSize('10000');
    expect(result).toEqual({ valid: true, kb: 10000 });
  });

  it('rejects empty string', () => {
    const result = validateTargetSize('');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects whitespace-only string', () => {
    const result = validateTargetSize('   ');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects non-numeric string', () => {
    const result = validateTargetSize('abc');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects value below minimum', () => {
    const result = validateTargetSize('5');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('10');
  });

  it('rejects value above maximum', () => {
    const result = validateTargetSize('20000');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('10000');
  });

  it('accepts decimal values within range', () => {
    const result = validateTargetSize('400.5');
    expect(result.valid).toBe(true);
    expect(result.kb).toBe(400.5);
  });

  it('rejects Infinity', () => {
    const result = validateTargetSize('Infinity');
    expect(result.valid).toBe(false);
  });

  it('handles string with leading/trailing whitespace', () => {
    const result = validateTargetSize('  400  ');
    expect(result).toEqual({ valid: true, kb: 400 });
  });
});

describe('loadTargetSize / saveTargetSize', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns default (400) when nothing is stored', () => {
    expect(loadTargetSize()).toBe(400);
  });

  it('returns the saved value after saveTargetSize', () => {
    saveTargetSize(250);
    expect(loadTargetSize()).toBe(250);
  });

  it('returns default when stored value is invalid', () => {
    localStorage.setItem('image-compressor-target-size', 'garbage');
    expect(loadTargetSize()).toBe(400);
  });

  it('returns default when stored value is out of range (too low)', () => {
    localStorage.setItem('image-compressor-target-size', '5');
    expect(loadTargetSize()).toBe(400);
  });

  it('returns default when stored value is out of range (too high)', () => {
    localStorage.setItem('image-compressor-target-size', '99999');
    expect(loadTargetSize()).toBe(400);
  });

  it('round-trips boundary values correctly', () => {
    saveTargetSize(10);
    expect(loadTargetSize()).toBe(10);

    saveTargetSize(10000);
    expect(loadTargetSize()).toBe(10000);
  });
});
