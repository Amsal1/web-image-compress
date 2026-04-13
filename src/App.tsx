import { useReducer, useRef, useEffect, useCallback, useState } from 'react';
import { queueReducer, createInitialState } from './state/queueReducer';
import { validateFiles } from './utils/fileValidator';
import { loadTargetSize } from './utils/targetSize';
import { decodeToImageBitmap } from './utils/formatDecoder';
import { compress } from './engine/compressor';
import { CanvasEncoder } from './engine/canvasEncoder';
import {
  MAX_COMPRESSION_STEPS,
  INITIAL_QUALITY,
  TOLERANCE_LOWER_PERCENT,
  TOLERANCE_UPPER_PERCENT,
} from './constants';
import { DropZone } from './components/DropZone';
import { TargetSizeInput } from './components/TargetSizeInput';
import { CompressionQueue } from './components/CompressionQueue';
import { DownloadAllButton } from './components/DownloadAllButton';
import type { CompressionConfig, RejectedFile } from './types';

function App() {
  const [state, dispatch] = useReducer(queueReducer, loadTargetSize(), createInitialState);
  const [targetSizeKB, setTargetSizeKB] = useState(() => loadTargetSize());
  const [rejectedFiles, setRejectedFiles] = useState<RejectedFile[]>([]);
  const encoderRef = useRef<CanvasEncoder | null>(null);

  // Lazily create encoder (avoids SSR issues with canvas)
  function getEncoder(): CanvasEncoder {
    if (!encoderRef.current) {
      encoderRef.current = new CanvasEncoder();
    }
    return encoderRef.current;
  }

  // Handle files selected from DropZone
  const handleFilesSelected = useCallback(
    (files: File[]) => {
      const targetSizeBytes = targetSizeKB * 1024;
      const { valid, rejected } = validateFiles(files, targetSizeBytes);

      setRejectedFiles(rejected);

      if (valid.length > 0) {
        dispatch({ type: 'ADD_FILES', payload: { files: valid } });
        dispatch({ type: 'START_PROCESSING' });
      }
    },
    [targetSizeKB],
  );

  // Handle target size change
  const handleTargetSizeChange = useCallback((kb: number) => {
    setTargetSizeKB(kb);
  }, []);

  // Stable ref for targetSizeKB so the processing function always reads the latest
  const targetSizeKBRef = useRef(targetSizeKB);
  targetSizeKBRef.current = targetSizeKB;

  // Processing loop — triggered only when a new item starts processing
  // We use currentIndex + isProcessing as deps (NOT state.queue) to avoid
  // cancelling the in-flight compression on every progress update.
  useEffect(() => {
    if (!state.isProcessing || state.currentIndex < 0) return;

    const currentItem = state.queue[state.currentIndex];
    if (!currentItem || currentItem.status !== 'processing') return;

    let cancelled = false;

    async function processItem() {
      const item = currentItem;

      if (item.alreadyUnderTarget) {
        if (!cancelled) dispatch({ type: 'SKIP_ITEM', payload: { id: item.id } });
        return;
      }

      try {
        const bitmap = await decodeToImageBitmap(item.file);
        if (cancelled) { bitmap.close(); return; }

        const targetSizeBytes = targetSizeKBRef.current * 1024;
        const config: CompressionConfig = {
          targetSizeBytes,
          toleranceLowerBound: Math.round(TOLERANCE_LOWER_PERCENT * targetSizeBytes),
          toleranceUpperBound: Math.round(TOLERANCE_UPPER_PERCENT * targetSizeBytes),
          maxSteps: MAX_COMPRESSION_STEPS,
          initialQuality: INITIAL_QUALITY,
        };

        const result = await compress(bitmap, config, getEncoder(), (progress) => {
          if (!cancelled) {
            dispatch({ type: 'UPDATE_PROGRESS', payload: { id: item.id, progress } });
          }
        });

        bitmap.close();
        if (cancelled) return;

        const compressedUrl = URL.createObjectURL(result.blob);
        dispatch({ type: 'COMPLETE_ITEM', payload: { id: item.id, result, compressedUrl } });
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Compression failed';
        dispatch({ type: 'FAIL_ITEM', payload: { id: item.id, error: message } });
      }
    }

    processItem();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isProcessing, state.currentIndex]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">Image Compressor</h1>

        <div className="mb-6">
          <TargetSizeInput value={targetSizeKB} onChange={handleTargetSizeChange} />
        </div>

        <div className="mb-6">
          <DropZone onFilesSelected={handleFilesSelected} disabled={state.isProcessing} />
        </div>

        {rejectedFiles.length > 0 && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="mb-2 text-sm font-medium text-red-800">
              Some files were rejected:
            </p>
            <ul className="list-inside list-disc space-y-1 text-xs text-red-700">
              {rejectedFiles.map((rf, i) => (
                <li key={i}>
                  {rf.file.name}: {rf.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mb-6">
          <CompressionQueue items={state.queue} />
        </div>

        <DownloadAllButton items={state.queue} />
      </div>
    </div>
  );
}

export default App;
