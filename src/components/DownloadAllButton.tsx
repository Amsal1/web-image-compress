import { useCallback } from 'react';
import type { QueueItem } from '../types';
import { downloadAll } from '../utils/downloadManager';

interface DownloadAllButtonProps {
  items: QueueItem[];
}

export function DownloadAllButton({ items }: DownloadAllButtonProps) {
  const completedItems = items.filter(
    (item) => item.status === 'completed' && item.result,
  );

  const handleClick = useCallback(() => {
    const downloadItems = completedItems.map((item) => ({
      blob: item.result!.blob,
      originalName: item.file.name,
    }));
    downloadAll(downloadItems);
  }, [completedItems]);

  if (completedItems.length < 2) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1"
    >
      Download All (ZIP)
    </button>
  );
}
