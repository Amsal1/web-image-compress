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

export function validateFiles(files: File[], targetSizeBytes: number): ValidationResult {
  const valid: ValidImageFile[] = [];
  const rejected: RejectedFile[] = [];

  for (const file of files) {
    if (!SUPPORTED_MIME_TYPES.has(file.type as ImageFormat)) {
      rejected.push({
        file,
        reason: `Unsupported format: ${file.type || 'unknown'}. Supported: ${SUPPORTED_LABEL}`,
      });
      continue;
    }

    valid.push({
      file,
      format: file.type as ImageFormat,
      alreadyUnderTarget: file.size <= targetSizeBytes,
    });
  }

  return { valid, rejected };
}
