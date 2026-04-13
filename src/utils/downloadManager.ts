import { zipSync } from 'fflate';

/**
 * Generates a compressed filename from the original.
 * Strips the extension and appends _compressed.jpg.
 */
export function generateFilename(originalName: string): string {
  const lastDot = originalName.lastIndexOf('.');
  const baseName = lastDot > 0 ? originalName.substring(0, lastDot) : originalName;
  return `${baseName}_compressed.jpg`;
}

/**
 * Downloads a single blob as a file using a temporary anchor element.
 */
export function downloadSingle(blob: Blob, originalName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = generateFilename(originalName);
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Downloads multiple blobs as a ZIP archive using fflate.
 */
export async function downloadAll(
  items: { blob: Blob; originalName: string }[],
): Promise<void> {
  const entries: Record<string, Uint8Array> = {};

  for (const item of items) {
    const buffer = await item.blob.arrayBuffer();
    const filename = generateFilename(item.originalName);
    entries[filename] = new Uint8Array(buffer);
  }

  const zipped = zipSync(entries);
  const zipBlob = new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' });

  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'compressed_images.zip';
  a.click();
  URL.revokeObjectURL(url);
}
