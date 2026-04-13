import type { EncodingEngine } from './encodingEngine.ts';

export class CanvasEncoder implements EncodingEngine {
  private useOffscreen: boolean;

  constructor() {
    this.useOffscreen = typeof OffscreenCanvas !== 'undefined';
  }

  async encode(image: ImageBitmap, quality: number): Promise<Blob> {
    if (this.useOffscreen) {
      const canvas = new OffscreenCanvas(image.width, image.height);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(image, 0, 0);
      return canvas.convertToBlob({ type: 'image/jpeg', quality });
    }

    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(image, 0, 0);

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
}
