import type { EncodingEngine } from './encodingEngine.ts';

export class CanvasEncoder implements EncodingEngine {
  private canvas: OffscreenCanvas | HTMLCanvasElement;
  private ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
  private useOffscreen: boolean;

  constructor() {
    this.useOffscreen = typeof OffscreenCanvas !== 'undefined';
    if (this.useOffscreen) {
      this.canvas = new OffscreenCanvas(1, 1);
      this.ctx = this.canvas.getContext('2d')!;
    } else {
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d')!;
    }
  }

  async encode(image: ImageBitmap, quality: number): Promise<Blob> {
    this.canvas.width = image.width;
    this.canvas.height = image.height;
    this.ctx.drawImage(image, 0, 0);

    if (this.useOffscreen) {
      return (this.canvas as OffscreenCanvas).convertToBlob({
        type: 'image/jpeg',
        quality,
      });
    }

    return new Promise<Blob>((resolve, reject) => {
      (this.canvas as HTMLCanvasElement).toBlob(
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
