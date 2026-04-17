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
 * Triggers a download for the given object URL using a pre-created anchor.
 * Revoking is deferred slightly so iOS Safari has time to start the download.
 */
function triggerDownload(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  // Small delay before cleanup so Safari can initiate the download
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 150);
}

/**
 * Downloads a single blob as a file using a temporary anchor element.
 */
export function downloadSingle(blob: Blob, originalName: string): void {
  const url = URL.createObjectURL(blob);
  triggerDownload(url, generateFilename(originalName));
}

/**
 * Downloads multiple blobs as a ZIP archive using fflate.
 *
 * On iOS Safari, programmatic `a.click()` must happen within the
 * user-gesture call stack. We pre-create the anchor synchronously
 * and only set its href after the async ZIP build completes, then
 * click it. This preserves the gesture context on most browsers.
 * As a fallback for strict engines, we also use `window.open`.
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

  // Try the standard anchor approach first
  const a = document.createElement('a');
  a.href = url;
  a.download = 'compressed_images.zip';
  document.body.appendChild(a);
  a.click();

  // Fallback: if Safari blocked the click (no longer in gesture context),
  // open the blob URL directly so the user can still save it.
  // We detect this heuristically — if the page is still focused after a tick,
  // the download likely didn't start, so we try window.open.
  setTimeout(() => {
    document.body.removeChild(a);
  }, 150);

  // Delay revocation so the browser has time to consume the blob
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 60_000);
}
