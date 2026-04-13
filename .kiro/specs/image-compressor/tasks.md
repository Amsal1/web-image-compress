# Implementation Plan: Image Compressor

## Overview

Build a frontend-only SPA for image compression using React 19, TypeScript, Vite 6, and Tailwind CSS 4. The implementation follows a bottom-up approach: core utilities and types first, then the compression engine, then UI components, and finally wiring everything together.

## Tasks

- [x] 1. Scaffold project and configure tooling
  - [x] 1.1 Initialize Vite + React + TypeScript project with `npm create vite@latest`
    - Configure `vite.config.ts` with static build output
    - Install dependencies: `react`, `react-dom`, `tailwindcss`, `heic2any`, `fflate`, `vitest`, `fast-check`, `@testing-library/react`, `@testing-library/jest-dom`
    - Configure Tailwind CSS 4
    - Configure Vitest in `vite.config.ts`
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 1.2 Create core TypeScript types and interfaces
    - Create `src/types.ts` with all shared types: `ImageFormat`, `ValidImageFile`, `RejectedFile`, `CompressionConfig`, `CompressionProgress`, `CompressionResult`, `QueueItem`, `AppState`
    - Create `src/constants.ts` with `SUPPORTED_MIME_TYPES`, `DEFAULT_TARGET_KB`, `MIN_TARGET_KB`, `MAX_TARGET_KB`, `MAX_COMPRESSION_STEPS`, `INITIAL_QUALITY`, `TOLERANCE_LOWER_PERCENT`, `TOLERANCE_UPPER_PERCENT`
    - _Requirements: 1.4, 2.1, 2.2, 2.4, 3.1_

- [x] 2. Implement file validation and target size utilities
  - [x] 2.1 Implement file validator in `src/utils/fileValidator.ts`
    - `validateFiles(files: File[], targetSizeBytes: number): ValidationResult`
    - Check MIME type against `SUPPORTED_MIME_TYPES` set (image/jpeg covers both .jpg and .jpeg)
    - Flag files smaller than target as `alreadyUnderTarget`
    - Return rejected files with descriptive error messages including the unsupported format
    - _Requirements: 1.4, 1.5_

  - [x] 2.2 Write property tests for file validator
    - **Property 1: Unsupported format rejection** — For any file with MIME type not in supported set, validator rejects with error message
    - **Property 2: Already-under-target detection** — For any file smaller than target size, validator marks as alreadyUnderTarget
    - **Validates: Requirements 1.4, 1.5**

  - [x] 2.3 Implement target size utilities in `src/utils/targetSize.ts`
    - `validateTargetSize(value: string): { valid: boolean; kb?: number; error?: string }`
    - `loadTargetSize(): number` — read from localStorage, fallback to 400
    - `saveTargetSize(kb: number): void` — persist to localStorage
    - Reject non-numeric, empty, < 10, > 10000
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 2.4 Write property tests for target size utilities
    - **Property 3: Target size localStorage round trip** — For any valid integer 10–10000, save then load returns same value
    - **Property 4: Target size validation rejects invalid inputs** — For any non-numeric string or number outside 10–10000, validation returns valid: false
    - **Validates: Requirements 2.3, 2.4, 2.5**

- [x] 3. Implement compression engine
  - [x] 3.1 Implement encoding engine in `src/engine/canvasEncoder.ts`
    - Create `EncodingEngine` interface in `src/engine/encodingEngine.ts`
    - Implement `CanvasEncoder` class using OffscreenCanvas (fallback to HTMLCanvasElement)
    - `encode(image: ImageBitmap, quality: number): Promise<Blob>` — draws to canvas, returns `toBlob('image/jpeg', quality)`
    - _Requirements: 3.7, 3.8, 8.1_

  - [x] 3.2 Implement binary-search compressor in `src/engine/compressor.ts`
    - `compress(image: ImageBitmap, config: CompressionConfig, encoder: EncodingEngine, onProgress?: callback): Promise<CompressionResult>`
    - Binary search over quality 0.0–1.0, starting at 0.7
    - Track best result (highest quality at or below target) for fallback
    - Stop when result is within tolerance range (95%–99% of target)
    - Max 20 steps, return best result with `converged: false` if limit reached
    - Call `onProgress` after each step with step number, max steps, current size, current quality
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 5.1, 5.2_

  - [x] 3.3 Write property tests for compressor
    - **Property 5: Binary search convergence** — For any monotonically decreasing mock encoder and target size with a solution, result is within tolerance range with maximal quality
    - **Property 6: Progress callbacks are complete** — For any compression run of N steps, onProgress is called N times with valid step, maxSteps, size, and quality
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.5, 5.1, 5.2**

- [x] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement download utilities
  - [x] 5.1 Implement download manager in `src/utils/downloadManager.ts`
    - `generateFilename(originalName: string): string` — returns `{name}_compressed.jpg`
    - `downloadSingle(blob: Blob, originalName: string): void` — create object URL, trigger `<a download>` click, revoke URL
    - `downloadAll(items: { blob: Blob; originalName: string }[]): Promise<void>` — use `fflate` to create ZIP, trigger download as `compressed_images.zip`
    - _Requirements: 4.3, 4.4, 4.5_

  - [x] 5.2 Write property tests for download manager
    - **Property 8: File naming pattern** — For any filename with extension, generateFilename returns `{name}_compressed.jpg`
    - **Property 9: ZIP archive completeness** — For any set of N ≥ 2 blobs, ZIP contains exactly N entries with correct names
    - **Validates: Requirements 4.4, 4.5**

- [x] 6. Implement HEIC/BMP decoding support
  - [x] 6.1 Implement format decoder in `src/utils/formatDecoder.ts`
    - `decodeToImageBitmap(file: File): Promise<ImageBitmap>` — for HEIC/HEIF, use `heic2any` to convert to JPEG blob first, then `createImageBitmap`; for JPEG/PNG/BMP, use `createImageBitmap` directly
    - _Requirements: 1.1, 1.3, 8.1_

- [x] 7. Implement React components and state management
  - [x] 7.1 Implement queue reducer in `src/state/queueReducer.ts`
    - Define action types: `ADD_FILES`, `START_PROCESSING`, `UPDATE_PROGRESS`, `COMPLETE_ITEM`, `FAIL_ITEM`, `SKIP_ITEM`, `CLEAR_QUEUE`
    - Implement reducer function managing `AppState` (queue, currentIndex, isProcessing)
    - _Requirements: 6.1, 6.3_

  - [x] 7.2 Write property tests for queue reducer
    - **Property 10: Batch sequential processing** — For any batch of N files, at most one item is in `processing` state at any time, and order is preserved
    - **Property 11: Batch failure isolation** — For any batch where item K fails, all other items still reach terminal state
    - **Validates: Requirements 6.1, 6.3**

  - [x] 7.3 Implement DropZone component in `src/components/DropZone.tsx`
    - Drag-and-drop area with `onDrop` and `onDragOver` handlers
    - Hidden file input with `accept` attribute for supported formats, triggered on click
    - Visual feedback on drag hover
    - Minimum 48x48 CSS pixel touch target
    - _Requirements: 1.1, 1.2, 1.3, 7.3_

  - [x] 7.4 Implement TargetSizeInput component in `src/components/TargetSizeInput.tsx`
    - Numeric input field with validation on change/blur
    - Display inline validation errors
    - Load initial value from localStorage, save on valid change
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 7.5 Implement PreviewPanel component in `src/components/PreviewPanel.tsx`
    - Side-by-side layout (stacked below 768px viewport) showing original and compressed images
    - Display metadata: original size, compressed size, compression ratio, quality parameter
    - Individual download button per result
    - _Requirements: 4.1, 4.2, 7.2_

  - [x] 7.6 Write property test for preview metadata
    - **Property 7: Preview metadata completeness** — For any CompressionResult, rendered preview contains original size, compressed size, ratio, and quality
    - **Validates: Requirements 4.2**

  - [x] 7.7 Implement QueueItem and CompressionQueue components in `src/components/CompressionQueue.tsx`
    - QueueItem: shows progress bar during compression, preview after completion, error on failure, "skipped" badge for under-target files
    - CompressionQueue: renders list of QueueItems with batch progress ("3 of 10 completed")
    - _Requirements: 5.1, 5.2, 5.3, 6.2_

  - [x] 7.8 Implement DownloadAllButton component in `src/components/DownloadAllButton.tsx`
    - Visible only when 2+ completed results exist
    - Triggers ZIP download via downloadAll utility
    - _Requirements: 4.4_

- [x] 8. Wire everything together in App component
  - [x] 8.1 Implement App component in `src/App.tsx`
    - Initialize queue state with useReducer
    - Initialize target size from localStorage
    - Wire DropZone → file validator → queue dispatch
    - Wire queue processing loop: when isProcessing and current item is pending, decode file → compress → dispatch result
    - Handle HEIC decoding, compression errors, and skip logic for under-target files
    - Render layout: header, TargetSizeInput, DropZone, CompressionQueue, DownloadAllButton
    - Responsive layout with Tailwind (single column, max-width container)
    - _Requirements: 1.1, 1.3, 1.5, 3.1, 5.3, 6.1, 6.3, 7.1_

- [x] 9. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Configure Cloudflare Pages deployment
  - [x] 10.1 Add Cloudflare Pages configuration
    - Create `wrangler.toml` or configure via Cloudflare dashboard settings: build command `npm run build`, output directory `dist`
    - Verify Vite build produces static output in `dist/` with hashed filenames
    - Ensure no server-side functions or API routes are included
    - _Requirements: 9.1, 9.2, 9.3_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- All output is JPEG regardless of input format (Canvas API limitation for lossy compression)
- The EncodingEngine interface allows swapping in WebAssembly codecs later without changing the compressor
- Property tests use `fast-check` with minimum 100 iterations each
- `heic2any` handles HEIC/HEIF decoding; all other formats use native `createImageBitmap`
