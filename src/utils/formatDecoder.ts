import { heicTo } from 'heic-to';
import type { ImageFormat } from '../types';

const HEIC_TYPES: Set<string> = new Set(['image/heic', 'image/heif']);

/**
 * Returns true if the current browser can likely decode HEIC natively.
 * Safari on macOS / iOS supports this; Chrome and Firefox do not.
 */
function canDecodeHeicNatively(): boolean {
  const ua = navigator.userAgent;
  // True Safari (not Chrome/Firefox on iOS)
  if (/safari/i.test(ua) && !/chrome|chromium|crios|fxios|android/i.test(ua)) {
    return true;
  }
  // iOS WebView (e.g. in-app browsers) — still uses WebKit and can decode HEIC
  if (/iphone|ipad|ipod/i.test(ua) && /applewebkit/i.test(ua)) {
    return true;
  }
  return false;
}

/**
 * Attempt to decode a HEIC/HEIF file using the browser's native decoder.
 * Returns the ImageBitmap on success, or null if native decoding fails.
 */
async function tryNativeDecode(file: File): Promise<ImageBitmap | null> {
  try {
    return await createImageBitmap(file);
  } catch {
    return null;
  }
}

/**
 * Attempt to decode a HEIC/HEIF file using heic-to (libheif 1.21 WASM).
 * Returns the ImageBitmap on success, or throws on failure.
 */
async function decodeViaHeicTo(file: File): Promise<ImageBitmap> {
  const bitmap = await heicTo({
    blob: file,
    type: 'bitmap',
  });
  return bitmap as ImageBitmap;
}

/**
 * Decodes a File to an ImageBitmap.
 *
 * Accepts an optional `detectedFormat` so callers can pass the format
 * determined by magic-byte sniffing (useful when `file.type` is empty on iOS).
 *
 * Strategy for HEIC/HEIF:
 * 1. If the browser can decode HEIC natively (Safari), try native first.
 *    If native fails, fall back to heic-to.
 * 2. If the browser can't decode HEIC natively (Chrome/Firefox), use heic-to.
 *    If heic-to fails, attempt native decode as a last resort (some newer
 *    Chrome versions are adding HEIC support).
 *
 * For JPEG/PNG/BMP, uses createImageBitmap directly.
 */
export async function decodeToImageBitmap(
  file: File,
  detectedFormat?: ImageFormat,
): Promise<ImageBitmap> {
  const format = detectedFormat ?? file.type;
  const isHeic = HEIC_TYPES.has(format);

  if (!isHeic) {
    return createImageBitmap(file);
  }

  // HEIC decoding with fallback chain
  if (canDecodeHeicNatively()) {
    // Safari path: try native first, fall back to heic-to
    const bitmap = await tryNativeDecode(file);
    if (bitmap) return bitmap;

    try {
      return await decodeViaHeicTo(file);
    } catch {
      throw new Error(
        'This HEIC file could not be decoded. It may use an unsupported codec or be corrupted.',
      );
    }
  } else {
    // Chrome/Firefox path: try heic-to first, fall back to native
    try {
      return await decodeViaHeicTo(file);
    } catch {
      const bitmap = await tryNativeDecode(file);
      if (bitmap) return bitmap;

      throw new Error(
        'This HEIC file could not be decoded. It may use an unsupported codec or be corrupted.',
      );
    }
  }
}
