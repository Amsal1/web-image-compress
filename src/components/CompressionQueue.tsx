import type { QueueItem } from '../types';
import { PreviewPanel } from './PreviewPanel';

function formatBytes(bytes: number): string {
  return (bytes / 1024).toFixed(1) + ' KB';
}

interface QueueItemComponentProps {
  item: QueueItem;
}

export function QueueItemComponent({ item }: QueueItemComponentProps) {
  const filename = item.file.name;

  if (item.status === 'pending') {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm font-medium text-gray-700">{filename}</p>
        <p className="mt-1 text-xs text-gray-400">Waiting...</p>
      </div>
    );
  }

  if (item.status === 'processing') {
    const step = item.progress?.step ?? 0;
    const maxSteps = item.progress?.maxSteps ?? 20;
    const pct = maxSteps > 0 ? (step / maxSteps) * 100 : 0;

    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm font-medium text-gray-700">{filename}</p>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-blue-600 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Step {step} / {maxSteps}
          {item.progress ? ` — ${formatBytes(item.progress.currentSizeBytes)}` : ''}
        </p>
      </div>
    );
  }

  if (item.status === 'completed' && item.result && item.compressedUrl) {
    return (
      <PreviewPanel
        originalUrl={item.originalUrl}
        originalSize={item.file.size}
        compressedUrl={item.compressedUrl}
        result={item.result}
        originalName={item.file.name}
      />
    );
  }

  if (item.status === 'failed') {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-medium text-gray-700">{filename}</p>
        <p className="mt-1 text-xs text-red-600">{item.error ?? 'Compression failed'}</p>
      </div>
    );
  }

  if (item.status === 'skipped') {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
        <p className="text-sm font-medium text-gray-700">{filename}</p>
        <span className="mt-1 inline-block rounded-full bg-yellow-200 px-2 py-0.5 text-xs font-medium text-yellow-800">
          Already under target
        </span>
      </div>
    );
  }

  return null;
}

interface CompressionQueueProps {
  items: QueueItem[];
}

export function CompressionQueue({ items }: CompressionQueueProps) {
  if (items.length === 0) return null;

  const doneCount = items.filter(
    (i) => i.status === 'completed' || i.status === 'failed' || i.status === 'skipped',
  ).length;

  return (
    <div className="w-full space-y-4">
      <p className="text-sm font-medium text-gray-600">
        {doneCount} of {items.length} completed
      </p>
      {items.map((item) => (
        <QueueItemComponent key={item.id} item={item} />
      ))}
    </div>
  );
}
