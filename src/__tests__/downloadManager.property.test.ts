import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { generateFilename } from '../utils/downloadManager';
import { zipSync, unzipSync } from 'fflate';

/**
 * Common file extensions for generating realistic filenames.
 */
const commonExtensions = ['jpg', 'jpeg', 'png', 'bmp', 'heic', 'heif', 'gif', 'tiff', 'webp'];

/**
 * Arbitrary that generates a non-empty base name (1+ alphanumeric/underscore/dash chars)
 * paired with a common extension.
 */
const filenameWithExtension = fc
  .tuple(
    fc
      .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789_-'.split('')), {
        minLength: 1,
        maxLength: 30,
      })
      .map((chars) => chars.join('')),
    fc.constantFrom(...commonExtensions),
  )
  .map(([name, ext]) => ({ fullName: `${name}.${ext}`, baseName: name }));

describe('Feature: image-compressor, Property 8: File naming pattern', () => {
  /**
   * **Validates: Requirements 4.4, 4.5**
   *
   * For any filename with an extension, generateFilename returns
   * `{name}_compressed.jpg` where `{name}` is the original filename
   * without its extension.
   */
  it('returns {name}_compressed.jpg for any filename with extension', () => {
    fc.assert(
      fc.property(filenameWithExtension, ({ fullName, baseName }) => {
        const result = generateFilename(fullName);
        expect(result).toBe(`${baseName}_compressed.jpg`);
      }),
      { numRuns: 100 },
    );
  });
});

describe('Feature: image-compressor, Property 9: ZIP archive completeness', () => {
  /**
   * **Validates: Requirements 4.4, 4.5**
   *
   * For any set of N ≥ 2 blobs, the ZIP archive contains exactly N entries
   * with the correct filenames matching the naming pattern.
   */
  it('ZIP contains exactly N entries with correct names for N ≥ 2 items', () => {
    /**
     * Generate an array of 2–10 items, each with a unique filename and small blob content.
     * We use a set-based approach to ensure unique base names.
     */
    const uniqueItems = fc
      .uniqueArray(
        fc.tuple(
          fc
            .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), {
              minLength: 1,
              maxLength: 20,
            })
            .map((chars) => chars.join('')),
          fc.constantFrom(...commonExtensions),
          fc.uint8Array({ minLength: 1, maxLength: 64 }),
        ),
        {
          minLength: 2,
          maxLength: 10,
          selector: ([name]) => name,
        },
      )
      .map((tuples) =>
        tuples.map(([name, ext, content]) => ({
          originalName: `${name}.${ext}`,
          content,
        })),
      );

    fc.assert(
      fc.property(uniqueItems, (items) => {
        // Build entries the same way downloadAll does
        const entries: Record<string, Uint8Array> = {};
        for (const item of items) {
          const filename = generateFilename(item.originalName);
          entries[filename] = item.content;
        }

        // Create and decompress the ZIP
        const zipped = zipSync(entries);
        const unzipped = unzipSync(zipped);

        const zipFilenames = Object.keys(unzipped);

        // Exactly N entries
        expect(zipFilenames).toHaveLength(items.length);

        // Each expected filename is present with correct content
        for (const item of items) {
          const expectedName = generateFilename(item.originalName);
          expect(zipFilenames).toContain(expectedName);
          expect(unzipped[expectedName]).toEqual(item.content);
        }
      }),
      { numRuns: 100 },
    );
  });
});
