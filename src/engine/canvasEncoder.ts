import type { EncodingEngine } from './encodingEngine.ts';

/**
 * Maximum canvas area (in pixels) to stay within iOS Safari memory limits.
 * Older iOS devices cap at ~16.7 MP; newer ones allow more.
 * We use 16.7 MP as a safe ceiling to cover the widest range of devices.
 */
const MAX_CANVAS_PIXELS = 16_777_216; // 4096 * 4096

export class CanvasEncoder implements EncodingEngine {
  private useOffscreen: boolean;

  constructor() {
    // Safari 16.4 introduced OffscreenCanvas but convertToBlob only landed in 17.0.
    // Check for the method itself to avoid runtime errors on 16.4–16.x.
    this.useOffscreen =
      typeof OffscreenCanvas !== 'undefined' &&
      typeof OffscreenCanvas.prototype.convertToBlob === 'function';
  }

  async encode(image: ImageBitmap, quality: number): Promise<Blob> {
    const { width, height } = this.constrainDimensions(image.width, image.height);

    if (this.useOffscreen) {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(image, 0, 0, width, height);
      return canvas.convertToBlob({ type: 'image/jpeg', quality });
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(image, 0, 0, width, height);

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas toBlob returned null'));
          }
        },
        'image/jpeg',
        quality,
      );
    });
  }

  /**
   * Downscale dimensions proportionally if the total pixel count exceeds
   * the safe canvas limit (primarily for iOS Safari).
   */
  private constrainDimensions(w: number, h: number): { width: number; height: number } {
    const pixels = w * h;
    if (pixels <= MAX_CANVAS_PIXELS) {
      return { width: w, height: h };
    }
    const scale = Math.sqrt(MAX_CANVAS_PIXELS / pixels);
    return {
      width: Math.floor(w * scale),
      height: Math.floor(h * scale),
    };
  }
}
