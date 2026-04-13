import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { queueReducer, createInitialState } from '../state/queueReducer';
import type { QueueAction } from '../state/queueReducer';
import type { AppState, ValidImageFile } from '../types';

/**
 * Helper: create a mock ValidImageFile
 */
function createMockValidFile(name: string): ValidImageFile {
  return {
    file: new File(['x'], name, { type: 'image/jpeg' }),
    format: 'image/jpeg' as const,
    alreadyUnderTarget: false,
  };
}

/**
 * Helper: create a mock CompressionResult
 */
function createMockResult() {
  return {
    blob: new Blob(['x']),
    sizeBytes: 100,
    quality: 0.8,
    steps: 5,
    converged: true,
  };
}

/**
 * Helper: dispatch an action and return the new state
 */
function dispatch(state: AppState, action: QueueAction): AppState {
  return queueReducer(state, action);
}

/**
 * Helper: count items with a given status
 */
function countByStatus(state: AppState, status: string): number {
  return state.queue.filter((item) => item.status === status).length;
}

describe('Feature: image-compressor, Property 10: Batch sequential processing', () => {
  /**
   * **Validates: Requirements 6.1, 6.3**
   *
   * For any batch of N files (2-10), at most one item is in `processing` state
   * at any time, and items are processed in the order they were added.
   */
  it('processes at most one item at a time and preserves order', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }),
        (n) => {
          // Create N mock files
          const files = Array.from({ length: n }, (_, i) => createMockValidFile(`file${i}.jpg`));

          // Start from initial state
          let state = createInitialState(400);

          // ADD_FILES
          state = dispatch(state, { type: 'ADD_FILES', payload: { files } });
          expect(state.queue).toHaveLength(n);
          expect(countByStatus(state, 'processing')).toBe(0);

          // START_PROCESSING — first item should become processing
          state = dispatch(state, { type: 'START_PROCESSING' });
          expect(countByStatus(state, 'processing')).toBeLessThanOrEqual(1);
          expect(state.isProcessing).toBe(true);

          // Track the order items are processed
          const processedOrder: number[] = [];

          // Process each item sequentially
          for (let step = 0; step < n; step++) {
            // Find the currently processing item
            const processingIndex = state.queue.findIndex((item) => item.status === 'processing');

            // At most 1 item is processing
            expect(countByStatus(state, 'processing')).toBeLessThanOrEqual(1);

            // There should be exactly 1 processing item (we haven't finished yet)
            expect(processingIndex).toBeGreaterThanOrEqual(0);

            // Record the order
            processedOrder.push(processingIndex);

            // Complete the current item
            const currentItem = state.queue[processingIndex];
            state = dispatch(state, {
              type: 'COMPLETE_ITEM',
              payload: {
                id: currentItem.id,
                result: createMockResult(),
                compressedUrl: 'blob:test',
              },
            });

            // After completing, still at most 1 processing
            expect(countByStatus(state, 'processing')).toBeLessThanOrEqual(1);
          }

          // All items should be completed
          expect(countByStatus(state, 'completed')).toBe(n);
          expect(state.isProcessing).toBe(false);

          // Items were processed in order (index 0, 1, 2, ...)
          for (let i = 0; i < processedOrder.length; i++) {
            expect(processedOrder[i]).toBe(i);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Feature: image-compressor, Property 11: Batch failure isolation', () => {
  /**
   * **Validates: Requirements 6.1, 6.3**
   *
   * For any batch of N files (2-10) where item at index K fails,
   * all other items still reach terminal state (completed), and
   * isProcessing is false at the end.
   */
  it('isolates failure so all other items still complete', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }).chain((n) =>
          fc.integer({ min: 0, max: n - 1 }).map((k) => ({ n, k })),
        ),
        ({ n, k }) => {
          // Create N mock files
          const files = Array.from({ length: n }, (_, i) => createMockValidFile(`file${i}.jpg`));

          // Start from initial state
          let state = createInitialState(400);

          // ADD_FILES then START_PROCESSING
          state = dispatch(state, { type: 'ADD_FILES', payload: { files } });
          state = dispatch(state, { type: 'START_PROCESSING' });

          // Process each item sequentially
          for (let step = 0; step < n; step++) {
            const processingIndex = state.queue.findIndex((item) => item.status === 'processing');
            expect(processingIndex).toBeGreaterThanOrEqual(0);

            const currentItem = state.queue[processingIndex];

            if (processingIndex === k) {
              // Fail item at index K
              state = dispatch(state, {
                type: 'FAIL_ITEM',
                payload: { id: currentItem.id, error: 'Test failure' },
              });
            } else {
              // Complete all other items
              state = dispatch(state, {
                type: 'COMPLETE_ITEM',
                payload: {
                  id: currentItem.id,
                  result: createMockResult(),
                  compressedUrl: 'blob:test',
                },
              });
            }
          }

          // Item K should be failed
          expect(state.queue[k].status).toBe('failed');

          // All other items should be completed
          for (let i = 0; i < n; i++) {
            if (i !== k) {
              expect(state.queue[i].status).toBe('completed');
            }
          }

          // Processing should be done
          expect(state.isProcessing).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});
