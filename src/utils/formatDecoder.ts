import heic2any from 'heic2any';
import type { ImageFormat } from '../types';

const HEIC_TYPES: Set<string> = new Set(['image/heic', 'image/heif']);

/**
 * Returns true if the current browser can decode HEIC natively.
 * Safari on macOS / iOS supports this; Chrome and Firefox do not.
 */
function canDecodeHeicNatively(): boolean {
  // Safari identifies itself without Chrome/Android in the UA string.
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

/**
 * Decodes a File to an ImageBitmap.
 *
 * Accepts an optional `detectedFormat` so callers can pass the format
 * determined by magic-byte sniffing (useful when `file.type` is empty on iOS).
 *
 * For HEIC/HEIF files on browsers that can't decode them natively,
 * converts to JPEG via heic2any first.
 * On Safari (which handles HEIC natively), skips the conversion entirely.
 */
export async function decodeToImageBitmap(
  file: File,
  detectedFormat?: ImageFormat,
): Promise<ImageBitmap> {
  const format = detectedFormat ?? file.type;
  const isHeic = HEIC_TYPES.has(format);

  if (isHeic && !canDecodeHeicNatively()) {
    const converted = await heic2any({ blob: file, toType: 'image/jpeg' });
    const blob = Array.isArray(converted) ? converted[0] : converted;
    return createImageBitmap(blob);
  }

  return createImageBitmap(file);
}
