import type {
  AppState,
  CompressionProgress,
  CompressionResult,
  QueueItem,
  ValidImageFile,
} from '../types';

// --- Action Types ---

type AddFilesAction = {
  type: 'ADD_FILES';
  payload: { files: ValidImageFile[] };
};

type StartProcessingAction = {
  type: 'START_PROCESSING';
};

type UpdateProgressAction = {
  type: 'UPDATE_PROGRESS';
  payload: { id: string; progress: CompressionProgress };
};

type CompleteItemAction = {
  type: 'COMPLETE_ITEM';
  payload: { id: string; result: CompressionResult; compressedUrl: string };
};

type FailItemAction = {
  type: 'FAIL_ITEM';
  payload: { id: string; error: string };
};

type SkipItemAction = {
  type: 'SKIP_ITEM';
  payload: { id: string };
};

type ClearQueueAction = {
  type: 'CLEAR_QUEUE';
};

export type QueueAction =
  | AddFilesAction
  | StartProcessingAction
  | UpdateProgressAction
  | CompleteItemAction
  | FailItemAction
  | SkipItemAction
  | ClearQueueAction;

// --- Helpers ---

let idCounter = 0;

function generateId(): string {
  return `item-${Date.now()}-${idCounter++}`;
}

function advanceToNextPending(queue: QueueItem[]): { queue: QueueItem[]; currentIndex: number; isProcessing: boolean } {
  const nextIndex = queue.findIndex((item) => item.status === 'pending');
  if (nextIndex === -1) {
    return { queue, currentIndex: -1, isProcessing: false };
  }
  const updatedQueue = queue.map((item, i) =>
    i === nextIndex ? { ...item, status: 'processing' as const } : item,
  );
  return { queue: updatedQueue, currentIndex: nextIndex, isProcessing: true };
}

// --- Reducer ---

export function queueReducer(state: AppState, action: QueueAction): AppState {
  switch (action.type) {
    case 'ADD_FILES': {
      const newItems: QueueItem[] = action.payload.files.map((vf) => ({
        id: generateId(),
        file: vf.file,
        status: 'pending' as const,
        originalUrl: URL.createObjectURL(vf.file),
        alreadyUnderTarget: vf.alreadyUnderTarget,
      }));
      return {
        ...state,
        queue: [...state.queue, ...newItems],
      };
    }

    case 'START_PROCESSING': {
      if (state.isProcessing) return state;
      const advanced = advanceToNextPending(state.queue);
      return { ...state, ...advanced };
    }

    case 'UPDATE_PROGRESS': {
      const { id, progress } = action.payload;
      return {
        ...state,
        queue: state.queue.map((item) =>
          item.id === id ? { ...item, progress } : item,
        ),
      };
    }

    case 'COMPLETE_ITEM': {
      const { id, result, compressedUrl } = action.payload;
      const updatedQueue = state.queue.map((item) =>
        item.id === id
          ? { ...item, status: 'completed' as const, result, compressedUrl, progress: undefined }
          : item,
      );
      const advanced = advanceToNextPending(updatedQueue);
      return { ...state, ...advanced };
    }

    case 'FAIL_ITEM': {
      const { id, error } = action.payload;
      const updatedQueue = state.queue.map((item) =>
        item.id === id
          ? { ...item, status: 'failed' as const, error, progress: undefined }
          : item,
      );
      const advanced = advanceToNextPending(updatedQueue);
      return { ...state, ...advanced };
    }

    case 'SKIP_ITEM': {
      const { id } = action.payload;
      const updatedQueue = state.queue.map((item) =>
        item.id === id
          ? { ...item, status: 'skipped' as const, progress: undefined }
          : item,
      );
      const advanced = advanceToNextPending(updatedQueue);
      return { ...state, ...advanced };
    }

    case 'CLEAR_QUEUE': {
      for (const item of state.queue) {
        URL.revokeObjectURL(item.originalUrl);
        if (item.compressedUrl) {
          URL.revokeObjectURL(item.compressedUrl);
        }
      }
      return {
        ...state,
        queue: [],
        currentIndex: -1,
        isProcessing: false,
      };
    }

    default:
      return state;
  }
}

// --- Initial State ---

export function createInitialState(targetSizeKB: number): AppState {
  return {
    targetSizeKB,
    queue: [],
    currentIndex: -1,
    isProcessing: false,
  };
}
