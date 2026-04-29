import type { ImageFormat, ValidationResult, ValidImageFile, RejectedFile } from '../types';
import { SUPPORTED_MIME_TYPES } from '../constants';

const FORMAT_LABELS: Record<ImageFormat, string> = {
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/heic': 'HEIC',
  'image/heif': 'HEIF',
  'image/bmp': 'BMP',
};

const SUPPORTED_LABEL = Object.values(FORMAT_LABELS).join(', ');

/**
 * Read the first N bytes of a file. Uses arrayBuffer() where available,
 * falls back to FileReader for older iOS Safari versions.
 */
function readFileHeader(file: File, bytes: number): Promise<Uint8Array> {
  const slice = file.slice(0, bytes);

  if (typeof slice.arrayBuffer === 'function') {
    return slice.arrayBuffer().then((buf) => new Uint8Array(buf));
  }

  // Fallback for older browsers (e.g. iOS Safari < 14)
  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(slice);
  });
}

/**
 * Detect image format from magic bytes when the browser-reported MIME type
 * is missing or unrecognised. This is common on iOS where HEIC files may
 * have an empty `file.type`.
 */
async function detectFormatFromBytes(file: File): Promise<ImageFormat | null> {
  try {
    // Read the first 12 bytes — enough for all signatures we check.
    const header = await readFileHeader(file, 12);

    // JPEG: FF D8 FF
    if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) {
      return 'image/jpeg';
    }

    // PNG: 89 50 4E 47
    if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
      return 'image/png';
    }

    // BMP: 42 4D
    if (header[0] === 0x42 && header[1] === 0x4D) {
      return 'image/bmp';
    }

    // HEIC/HEIF: ftyp box starting at offset 4
    if (header.length >= 12) {
      const ftyp =
        String.fromCharCode(header[4]) +
        String.fromCharCode(header[5]) +
        String.fromCharCode(header[6]) +
        String.fromCharCode(header[7]);

      if (ftyp === 'ftyp') {
        const brand =
          String.fromCharCode(header[8]) +
          String.fromCharCode(header[9]) +
          String.fromCharCode(header[10]) +
          String.fromCharCode(header[11]);

        const heicBrands = ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'];
        if (heicBrands.includes(brand)) {
          return 'image/heic';
        }
      }
    }

    // Also check file extension as a last resort
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'heic') return 'image/heic';
    if (ext === 'heif') return 'image/heif';
  } catch {
    // arrayBuffer may fail on very small/corrupt files — fall through
  }

  return null;
}

export async function validateFiles(files: File[], targetSizeBytes: number): Promise<ValidationResult> {
  const valid: ValidImageFile[] = [];
  const rejected: RejectedFile[] = [];

  for (const file of files) {
    let format = file.type as ImageFormat;

    // If the browser didn't provide a recognised MIME type, try magic bytes.
    if (!SUPPORTED_MIME_TYPES.has(format)) {
      const detected = await detectFormatFromBytes(file);
      if (detected) {
        format = detected;
      }
    }

    if (!SUPPORTED_MIME_TYPES.has(format)) {
      rejected.push({
        file,
        reason: `Unsupported format: ${file.type || 'unknown'}. Supported: ${SUPPORTED_LABEL}`,
      });
      continue;
    }

    valid.push({
      file,
      format,
      alreadyUnderTarget: file.size <= targetSizeBytes,
    });
  }

  return { valid, rejected };
}
