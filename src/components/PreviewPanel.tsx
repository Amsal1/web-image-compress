import { useCallback } from 'react';
import type { CompressionResult } from '../types';
import { downloadSingle } from '../utils/downloadManager';

interface PreviewPanelProps {
  originalUrl: string;
  originalSize: number;
  compressedUrl: string;
  result: CompressionResult;
  originalName: string;
}

function formatBytes(bytes: number): string {
  return (bytes / 1024).toFixed(1) + ' KB';
}

function compressionRatio(originalSize: number, compressedSize: number): string {
  const reduction = ((1 - compressedSize / originalSize) * 100).toFixed(0);
  return `${reduction}% reduction`;
}

export function PreviewPanel({
  originalUrl,
  originalSize,
  compressedUrl,
  result,
  originalName,
}: PreviewPanelProps) {
  const handleDownload = useCallback(() => {
    downloadSingle(result.blob, originalName);
  }, [result.blob, originalName]);

  return (
    <div className="w-full rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      {/* Side-by-side images, stacked below md (768px) */}
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="flex-1">
          <p className="mb-2 text-xs font-medium text-gray-500">Original</p>
          <img
            src={originalUrl}
            alt="Original"
            className="h-auto w-full rounded border border-gray-100 object-contain"
          />
        </div>
        <div className="flex-1">
          <p className="mb-2 text-xs font-medium text-gray-500">Compressed</p>
          <img
            src={compressedUrl}
            alt="Compressed"
            className="h-auto w-full rounded border border-gray-100 object-contain"
          />
        </div>
      </div>

      {/* Metadata */}
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-4">
        <div>
          <dt className="text-xs text-gray-500">Original size</dt>
          <dd className="font-medium text-gray-900" data-testid="original-size">
            {formatBytes(originalSize)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Compressed size</dt>
          <dd className="font-medium text-gray-900" data-testid="compressed-size">
            {formatBytes(result.sizeBytes)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Reduction</dt>
          <dd className="font-medium text-gray-900" data-testid="compression-ratio">
            {compressionRatio(originalSize, result.sizeBytes)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Quality</dt>
          <dd className="font-medium text-gray-900" data-testid="quality">
            {result.quality.toFixed(2)}
          </dd>
        </div>
      </dl>

      {/* Download button */}
      <div className="mt-4">
        <button
          type="button"
          onClick={handleDownload}
          className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
        >
          Download
        </button>
      </div>
    </div>
  );
}
