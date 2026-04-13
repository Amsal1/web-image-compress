import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateFiles } from '../utils/fileValidator';
import { SUPPORTED_MIME_TYPES } from '../constants';
import type { ImageFormat } from '../types';

const SUPPORTED_LIST: ImageFormat[] = [...SUPPORTED_MIME_TYPES];

function makeFile(name: string, type: string, size: number): File {
  const buffer = new ArrayBuffer(size);
  return new File([buffer], name, { type });
}

/**
 * Generates a MIME type string that is NOT in the supported set.
 * Produces realistic MIME-like strings (type/subtype) as well as
 * arbitrary strings, empty strings, etc.
 */
const unsupportedMimeType = fc
  .oneof(
    // Realistic MIME types that aren't supported
    fc.constantFrom(
      'application/pdf',
      'text/plain',
      'image/webp',
      'image/gif',
      'image/svg+xml',
      'image/tiff',
      'video/mp4',
      'audio/mpeg',
    ),
    // Random type/subtype pattern
    fc
      .tuple(fc.string({ minLength: 1, maxLength: 20 }), fc.string({ minLength: 1, maxLength: 20 }))
      .map(([type, subtype]) => `${type}/${subtype}`),
    // Empty string
    fc.constant(''),
    // Arbitrary strings
    fc.string({ minLength: 0, maxLength: 50 }),
  )
  .filter((mime) => !SUPPORTED_MIME_TYPES.has(mime as ImageFormat));

describe('Feature: image-compressor, Property 1: Unsupported format rejection', () => {
  /**
   * **Validates: Requirements 1.4**
   *
   * For any file with a MIME type not in the supported set,
   * the validator rejects the file with an error message containing the MIME type.
   */
  it('rejects any file with unsupported MIME type and includes the format in the reason', () => {
    fc.assert(
      fc.property(unsupportedMimeType, fc.integer({ min: 0, max: 10_000_000 }), (mimeType, fileSize) => {
        const file = makeFile('test-file', mimeType, fileSize);
        const result = validateFiles([file], 400_000);

        // File must be in rejected array
        expect(result.rejected).toHaveLength(1);
        expect(result.valid).toHaveLength(0);

        // Reason must contain the MIME type (or 'unknown' for empty).
        // Note: the File API lowercases MIME types, so we compare case-insensitively.
        const expectedToken = mimeType || 'unknown';
        expect(result.rejected[0].reason.toLowerCase()).toContain(expectedToken.toLowerCase());
        expect(result.rejected[0].file).toBe(file);
      }),
      { numRuns: 100 },
    );
  });
});

describe('Feature: image-compressor, Property 2: Already-under-target detection', () => {
  /**
   * **Validates: Requirements 1.5**
   *
   * For any file with a supported MIME type whose size is <= target size,
   * the validator marks it as alreadyUnderTarget: true.
   */
  it('marks any supported file at or below target size as alreadyUnderTarget', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...SUPPORTED_LIST),
        // targetSize >= 1 so we can generate fileSize <= targetSize
        fc.integer({ min: 1, max: 10_000_000 }),
        fc.integer({ min: 0, max: 10_000_000 }),
        (mimeType, targetSize, rawFileSize) => {
          // Ensure fileSize <= targetSize
          const fileSize = rawFileSize % (targetSize + 1);
          const file = makeFile('photo.jpg', mimeType, fileSize);
          const result = validateFiles([file], targetSize);

          expect(result.valid).toHaveLength(1);
          expect(result.rejected).toHaveLength(0);
          expect(result.valid[0].alreadyUnderTarget).toBe(true);
          expect(result.valid[0].format).toBe(mimeType);
        },
      ),
      { numRuns: 100 },
    );
  });
});
