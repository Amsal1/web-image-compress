import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { compress } from '../engine/compressor';
import type { EncodingEngine } from '../engine/encodingEngine';
import type { CompressionConfig, CompressionProgress } from '../types';

/**
 * Creates a mock encoder where size is monotonically decreasing with quality:
 * encode(image, quality) => Blob of size Math.round(baseSize * quality)
 */
function createMockEncoder(baseSize: number): EncodingEngine {
  return {
    encode: async (_image: ImageBitmap, quality: number): Promise<Blob> => {
      const size = Math.round(baseSize * quality);
      return new Blob([new ArrayBuffer(size)]);
    },
  };
}

/** Fake ImageBitmap since we're in jsdom and the mock encoder ignores it */
const fakeImage = {} as ImageBitmap;

/**
 * Generates a { baseSize, targetSizeBytes } pair where a solution exists
 * within the tolerance range [0.95 * target, 0.99 * target].
 *
 * For the mock encoder f(q) = baseSize * q, a solution exists when there's
 * a quality q in [0, 1] such that 0.95 * target <= baseSize * q <= 0.99 * target.
 * This requires: 0.99 * target / baseSize <= 1, i.e., target <= baseSize / 0.99.
 * And: 0.95 * target / baseSize > 0, which is always true for positive values.
 */
const convergentParams = fc
  .integer({ min: 100_000, max: 10_000_000 })
  .chain((baseSize) => {
    // target must be <= baseSize / 0.99 so that the required quality <= 1
    // Also target must be large enough that tolerance range is meaningful
    const maxTarget = Math.floor(baseSize / 0.99);
    // Minimum target: ensure tolerance lower bound produces a positive size
    // 0.95 * target >= 1 => target >= 2
    const minTarget = Math.max(1000, Math.ceil(baseSize * 0.05));
    if (minTarget > maxTarget) {
      // Shouldn't happen with our ranges, but guard anyway
      return fc.constant({ baseSize, targetSizeBytes: Math.floor(baseSize * 0.5) });
    }
    return fc.integer({ min: minTarget, max: maxTarget }).map((targetSizeBytes) => ({
      baseSize,
      targetSizeBytes,
    }));
  });

describe('Feature: image-compressor, Property 5: Binary search convergence', () => {
  /**
   * **Validates: Requirements 3.2, 3.3, 3.4, 3.5**
   *
   * For any monotonically decreasing mock encoder and target size where a solution
   * exists within the tolerance range, the compress function should return a result
   * where the output size is within the tolerance range (converged) OR the result
   * is the best effort at or below the target size.
   */
  it('converges within tolerance range or returns best result at or below target', async () => {
    await fc.assert(
      fc.asyncProperty(convergentParams, async ({ baseSize, targetSizeBytes }) => {
        const encoder = createMockEncoder(baseSize);
        const toleranceLowerBound = Math.round(0.95 * targetSizeBytes);
        const toleranceUpperBound = Math.round(0.99 * targetSizeBytes);

        const config: CompressionConfig = {
          targetSizeBytes,
          toleranceLowerBound,
          toleranceUpperBound,
          maxSteps: 20,
          initialQuality: 0.7,
        };

        const result = await compress(fakeImage, config, encoder);

        if (result.converged) {
          // If converged, size must be within tolerance range
          expect(result.sizeBytes).toBeGreaterThanOrEqual(toleranceLowerBound);
          expect(result.sizeBytes).toBeLessThanOrEqual(toleranceUpperBound);
        } else {
          // If not converged, result should still be at or below target
          expect(result.sizeBytes).toBeLessThanOrEqual(targetSizeBytes);
        }

        // Quality must always be in valid range
        expect(result.quality).toBeGreaterThanOrEqual(0);
        expect(result.quality).toBeLessThanOrEqual(1);

        // Steps must be within bounds
        expect(result.steps).toBeGreaterThanOrEqual(1);
        expect(result.steps).toBeLessThanOrEqual(config.maxSteps);
      }),
      { numRuns: 100 },
    );
  });
});

describe('Feature: image-compressor, Property 6: Progress callbacks are complete', () => {
  /**
   * **Validates: Requirements 5.1, 5.2**
   *
   * For any compression run of N steps, onProgress is called N times with
   * valid step, maxSteps, size, and quality values.
   */
  it('calls onProgress exactly N times with valid fields for a run of N steps', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100_000, max: 10_000_000 }),
        fc.integer({ min: 1, max: 20 }),
        async (baseSize, maxSteps) => {
          const encoder = createMockEncoder(baseSize);
          // Set target above what the encoder can ever produce (max is baseSize at q=1.0).
          // This ensures the algorithm never converges and runs all maxSteps,
          // and every result is at or below target so bestResult is always populated.
          const targetSizeBytes = baseSize + 1000;
          const toleranceLowerBound = baseSize + 500;
          const toleranceUpperBound = baseSize + 900;

          const config: CompressionConfig = {
            targetSizeBytes,
            toleranceLowerBound,
            toleranceUpperBound,
            maxSteps,
            initialQuality: 0.7,
          };

          const progressCalls: CompressionProgress[] = [];
          const result = await compress(fakeImage, config, encoder, (progress) => {
            progressCalls.push({ ...progress });
          });

          // Number of callbacks must equal result.steps
          expect(progressCalls).toHaveLength(result.steps);

          // Validate each callback
          for (let i = 0; i < progressCalls.length; i++) {
            const p = progressCalls[i];

            // Step numbers go from 1 to N
            expect(p.step).toBe(i + 1);

            // maxSteps matches config
            expect(p.maxSteps).toBe(maxSteps);

            // Size must be > 0 (baseSize * quality > 0 for quality > 0)
            expect(p.currentSizeBytes).toBeGreaterThan(0);

            // Quality must be between 0 and 1
            expect(p.currentQuality).toBeGreaterThanOrEqual(0);
            expect(p.currentQuality).toBeLessThanOrEqual(1);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
