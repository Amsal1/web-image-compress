export type ImageFormat =
  | 'image/jpeg'
  | 'image/png'
  | 'image/heic'
  | 'image/heif'
  | 'image/bmp';

export interface ValidImageFile {
  file: File;
  format: ImageFormat;
  alreadyUnderTarget: boolean;
}

export interface RejectedFile {
  file: File;
  reason: string;
}

export interface ValidationResult {
  valid: ValidImageFile[];
  rejected: RejectedFile[];
}

export interface CompressionConfig {
  targetSizeBytes: number;
  toleranceLowerBound: number;
  toleranceUpperBound: number;
  maxSteps: number;
  initialQuality: number;
}

export interface CompressionProgress {
  step: number;
  maxSteps: number;
  currentSizeBytes: number;
  currentQuality: number;
}

export interface CompressionResult {
  blob: Blob;
  sizeBytes: number;
  quality: number;
  steps: number;
  converged: boolean;
}

export interface QueueItem {
  id: string;
  file: File;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
  progress?: CompressionProgress;
  result?: CompressionResult;
  error?: string;
  originalUrl: string;
  compressedUrl?: string;
  alreadyUnderTarget: boolean;
}

export interface AppState {
  targetSizeKB: number;
  queue: QueueItem[];
  currentIndex: number;
  isProcessing: boolean;
}
