import type { ImageFormat } from './types';

export const SUPPORTED_MIME_TYPES: Set<ImageFormat> = new Set([
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/bmp',
]);

export const DEFAULT_TARGET_KB = 400;
export const MIN_TARGET_KB = 10;
export const MAX_TARGET_KB = 10_000;
export const MAX_COMPRESSION_STEPS = 20;
export const INITIAL_QUALITY = 0.7;
export const TOLERANCE_LOWER_PERCENT = 0.95;
export const TOLERANCE_UPPER_PERCENT = 0.99;
