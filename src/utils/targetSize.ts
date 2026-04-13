import { DEFAULT_TARGET_KB, MIN_TARGET_KB, MAX_TARGET_KB } from '../constants';

const TARGET_SIZE_KEY = 'image-compressor-target-size';

export function validateTargetSize(value: string): { valid: boolean; kb?: number; error?: string } {
  const trimmed = value.trim();

  if (trimmed === '') {
    return { valid: false, error: 'Target size cannot be empty' };
  }

  const parsed = Number(trimmed);

  if (isNaN(parsed) || !isFinite(parsed)) {
    return { valid: false, error: 'Target size must be a number' };
  }

  if (parsed < MIN_TARGET_KB) {
    return { valid: false, error: `Target size must be at least ${MIN_TARGET_KB} KB` };
  }

  if (parsed > MAX_TARGET_KB) {
    return { valid: false, error: `Target size must be at most ${MAX_TARGET_KB} KB` };
  }

  return { valid: true, kb: parsed };
}

export function loadTargetSize(): number {
  try {
    const stored = localStorage.getItem(TARGET_SIZE_KEY);
    if (stored !== null) {
      const parsed = Number(stored);
      if (!isNaN(parsed) && parsed >= MIN_TARGET_KB && parsed <= MAX_TARGET_KB) {
        return parsed;
      }
    }
  } catch {
    // localStorage may be unavailable
  }
  return DEFAULT_TARGET_KB;
}

export function saveTargetSize(kb: number): void {
  try {
    localStorage.setItem(TARGET_SIZE_KEY, String(kb));
  } catch {
    // localStorage may be unavailable
  }
}
