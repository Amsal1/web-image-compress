import { describe, it, expect, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { render, screen, cleanup } from '@testing-library/react';
import { PreviewPanel } from '../components/PreviewPanel';
import type { CompressionResult } from '../types';

describe('Feature: image-compressor, Property 7: Preview metadata completeness', () => {
  afterEach(() => {
    cleanup();
  });

  /**
   * **Validates: Requirements 4.2**
   *
   * For any CompressionResult, the rendered preview metadata should contain
   * the original file size, the compressed file size, the compression ratio,
   * and the quality parameter used.
   */
  it('renders all four metadata fields for any CompressionResult', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 5_000_000 }).chain((sizeBytes) =>
          fc.record({
            sizeBytes: fc.constant(sizeBytes),
            quality: fc.double({ min: 0, max: 1, noNaN: true }),
            steps: fc.integer({ min: 1, max: 20 }),
            converged: fc.boolean(),
            originalSize: fc.integer({ min: sizeBytes + 1, max: 10_000_000 }),
          }),
        ),
        ({ sizeBytes, quality, steps, converged, originalSize }) => {
          const result: CompressionResult = {
            blob: new Blob(['x']),
            sizeBytes,
            quality,
            steps,
            converged,
          };

          render(
            <PreviewPanel
              originalUrl="blob:original"
              originalSize={originalSize}
              compressedUrl="blob:compressed"
              result={result}
              originalName="test.jpg"
            />,
          );

          // original-size contains formatted original size
          const expectedOriginalSize = (originalSize / 1024).toFixed(1) + ' KB';
          expect(screen.getByTestId('original-size').textContent).toBe(expectedOriginalSize);

          // compressed-size contains formatted compressed size
          const expectedCompressedSize = (sizeBytes / 1024).toFixed(1) + ' KB';
          expect(screen.getByTestId('compressed-size').textContent).toBe(expectedCompressedSize);

          // compression-ratio contains "% reduction"
          const expectedReduction = ((1 - sizeBytes / originalSize) * 100).toFixed(0);
          expect(screen.getByTestId('compression-ratio').textContent).toBe(
            `${expectedReduction}% reduction`,
          );

          // quality contains quality formatted to 2 decimal places
          expect(screen.getByTestId('quality').textContent).toBe(quality.toFixed(2));

          cleanup();
        },
      ),
      { numRuns: 100 },
    );
  });
});
