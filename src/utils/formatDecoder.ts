import heic2any from 'heic2any';

const HEIC_TYPES = new Set(['image/heic', 'image/heif']);

/**
 * Decodes a File to an ImageBitmap.
 * For HEIC/HEIF files, converts to JPEG via heic2any first.
 * For JPEG/PNG/BMP, uses createImageBitmap directly.
 */
export async function decodeToImageBitmap(file: File): Promise<ImageBitmap> {
  if (HEIC_TYPES.has(file.type)) {
    const converted = await heic2any({ blob: file, toType: 'image/jpeg' });
    const blob = Array.isArray(converted) ? converted[0] : converted;
    return createImageBitmap(blob);
  }

  return createImageBitmap(file);
}
