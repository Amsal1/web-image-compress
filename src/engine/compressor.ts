import type { CompressionConfig, CompressionProgress, CompressionResult } from '../types';
import type { EncodingEngine } from './encodingEngine';

export async function compress(
  image: ImageBitmap,
  config: CompressionConfig,
  encoder: EncodingEngine,
  onProgress?: (progress: CompressionProgress) => void,
): Promise<CompressionResult> {
  let low = 0.0;
  let high = 1.0;
  let quality = config.initialQuality;
  let bestResult: CompressionResult | null = null;

  for (let step = 1; step <= config.maxSteps; step++) {
    const blob = await encoder.encode(image, quality);
    const size = blob.size;

    onProgress?.({
      step,
      maxSteps: config.maxSteps,
      currentSizeBytes: size,
      currentQuality: quality,
    });

    if (size >= config.toleranceLowerBound && size <= config.toleranceUpperBound) {
      return { blob, sizeBytes: size, quality, steps: step, converged: true };
    }

    if (size <= config.targetSizeBytes) {
      if (bestResult === null || quality > bestResult.quality) {
        bestResult = { blob, sizeBytes: size, quality, steps: step, converged: false };
      }
    }

    if (size > config.targetSizeBytes) {
      high = quality;
      quality = (low + quality) / 2;
    } else if (size < config.toleranceLowerBound) {
      low = quality;
      quality = (quality + high) / 2;
    }
  }

  return { ...bestResult!, converged: false };
}
