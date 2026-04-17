import { useState, useRef, useCallback, useMemo } from 'react';
import type { DragEvent, ChangeEvent } from 'react';

interface DropZoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

const ACCEPT = '.jpg,.jpeg,.png,.heic,.heif,.bmp,image/jpeg,image/png,image/heic,image/heif,image/bmp';

/**
 * Detect touch-only devices (iOS / Android) where drag-and-drop from
 * external apps is not supported. We show adjusted copy for these users.
 */
function isTouchDevice(): boolean {
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0
  );
}

export function DropZone({ onFilesSelected, disabled = false }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isTouch = useMemo(() => isTouchDevice(), []);

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (!disabled) setIsDragOver(true);
    },
    [disabled],
  );

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      if (disabled) return;
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) onFilesSelected(files);
    },
    [disabled, onFilesSelected],
  );

  const handleClick = useCallback(() => {
    if (!disabled) fileInputRef.current?.click();
  }, [disabled]);

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length > 0) onFilesSelected(files);
      // Reset so the same file can be selected again
      e.target.value = '';
    },
    [onFilesSelected],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={isTouch ? 'Tap to select images' : 'Drop images here or click to select'}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        flex min-h-[48px] min-w-[48px] cursor-pointer flex-col items-center justify-center
        rounded-lg border-2 border-dashed p-8 transition-colors
        ${isDragOver
          ? 'border-blue-500 bg-blue-50 text-blue-600'
          : 'border-gray-300 bg-white text-gray-500 hover:border-gray-400 hover:bg-gray-50'
        }
        ${disabled ? 'pointer-events-none opacity-50' : ''}
      `}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="mb-2 h-10 w-10"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
        />
      </svg>
      <p className="text-sm font-medium">
        {isTouch ? 'Tap to select images' : 'Drop images here or click to select'}
      </p>
      <p className="mt-1 text-xs">JPEG, PNG, HEIC, HEIF, BMP</p>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPT}
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  );
}
