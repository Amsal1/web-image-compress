# Design Document: Image Compressor

## Overview

The Image Compressor is a single-page application built with React, TypeScript, and Vite. It compresses user-provided images to a precise target file size using a binary-search algorithm over the quality parameter. The application runs entirely in the browser — all image encoding is performed via the Canvas API (with optional WebAssembly codec upgrades in the future). The UI follows a single-column flow: a drop zone at the top, a target size input, and a results list below showing progress and previews.

### Technology Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | React 19 + TypeScript | Type safety, component model, ecosystem |
| Build Tool | Vite 6 | Fast HMR, static output, Wasm support |
| Styling | Tailwind CSS 4 | Utility-first, responsive, minimal bundle |
| Image Encoding | Canvas API (`toBlob`/`toDataURL`) | Zero-dependency, browser-native, sufficient quality for JPEG output |
| HEIC/HEIF Decoding | `heic2any` library | Browser Canvas cannot decode HEIC natively; this library converts HEIC/HEIF to JPEG/PNG blobs client-side |
| ZIP Packaging | `fflate` | Lightweight, fast, pure-JS zip library (~8KB gzipped) |
| Testing | Vitest + fast-check | Vitest for unit/integration, fast-check for property-based tests |
| Deployment | Static files (Vite build) | Compatible with Cloudflare Pages |

### Key Design Decisions

1. **Canvas API over WebAssembly codecs**: The Canvas API `toBlob()` with JPEG output provides good quality and is universally supported. WebAssembly codecs (mozjpeg, libwebp) offer marginally better quality-per-byte but add significant bundle size and complexity. The architecture abstracts the encoding behind an interface so Wasm codecs can be swapped in later without changing the compression algorithm.

2. **Sequential batch processing**: Images are processed one at a time to avoid overwhelming the main thread. Web Workers are not used in the initial implementation to keep complexity low, but the architecture supports adding them later.

3. **JPEG output format**: All compressed output is JPEG regardless of input format. JPEG is the only lossy format the Canvas API supports with a quality parameter. PNG inputs are re-encoded as JPEG for compression. This is acceptable for the medical photo use case.

## Architecture

```mermaid
graph TD
    A[Drop Zone Component] -->|File[]| B[File Validator]
    B -->|ValidImageFile[]| C[Compression Queue]
    C -->|ImageFile| D[Compressor Engine]
    D -->|quality, ImageBitmap| E[Encoding Engine Interface]
    E -->|Blob| D
    D -->|CompressedResult| F[Results Store]
    F --> G[Preview Panel Component]
    F --> H[Download Manager]
    
    I[Target Size Input] -->|targetSizeKB| D
    I -->|targetSizeKB| J[LocalStorage]
    
    subgraph "Encoding Backends"
        E --> E1[Canvas API Encoder]
        E --> E2[Future: Wasm Encoder]
    end
```

The architecture follows a unidirectional data flow:

1. **Input Layer**: Drop Zone and file picker collect files; Target Size Input provides the size constraint.
2. **Validation Layer**: File Validator checks MIME types and file sizes, rejecting unsupported formats.
3. **Processing Layer**: Compression Queue manages sequential processing. Compressor Engine runs the binary-search algorithm. Encoding Engine Interface abstracts the actual image encoding.
4. **Output Layer**: Results Store holds all compression results. Preview Panel renders them. Download Manager handles individual and bulk downloads.

## Components and Interfaces

### Encoding Engine Interface

```typescript
interface EncodingEngine {
  encode(image: ImageBitmap, quality: number): Promise<Blob>;
}
```

The `CanvasEncoder` implementation:

```typescript
class CanvasEncoder implements EncodingEngine {
  private canvas: OffscreenCanvas | HTMLCanvasElement;

  async encode(image: ImageBitmap, quality: number): Promise<Blob> {
    // Draws image to canvas, returns toBlob('image/jpeg', quality)
  }
}
```

### File Validator

```typescript
const SUPPORTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/bmp',
]);

interface ValidationResult {
  valid: ValidImageFile[];
  rejected: RejectedFile[];
}

function validateFiles(files: File[], targetSizeKB: number): ValidationResult;
```

Validates MIME type against the supported set. Both `.jpg` and `.jpeg` extensions map to `image/jpeg` MIME type and are handled identically. Files already below target size are flagged with `alreadyUnderTarget: true` rather than rejected.

### Compressor Engine

```typescript
interface CompressionConfig {
  targetSizeBytes: number;
  toleranceLowerBound: number; // 0.95 * targetSize
  toleranceUpperBound: number; // 0.99 * targetSize
  maxSteps: number;            // 20
  initialQuality: number;      // 0.7
}

interface CompressionProgress {
  step: number;
  maxSteps: number;
  currentSizeBytes: number;
  currentQuality: number;
}

interface CompressionResult {
  blob: Blob;
  sizeBytes: number;
  quality: number;
  steps: number;
  converged: boolean;
}

async function compress(
  image: ImageBitmap,
  config: CompressionConfig,
  encoder: EncodingEngine,
  onProgress?: (progress: CompressionProgress) => void
): Promise<CompressionResult>;
```

The `compress` function implements the binary-search algorithm:

```
function compress(image, config, encoder, onProgress):
  low = 0.0
  high = 1.0
  quality = config.initialQuality
  bestResult = null  // best result at or below target

  for step = 1 to config.maxSteps:
    blob = encoder.encode(image, quality)
    size = blob.size
    onProgress({ step, maxSteps, currentSizeBytes: size, currentQuality: quality })

    if size >= config.toleranceLowerBound AND size <= config.toleranceUpperBound:
      return { blob, sizeBytes: size, quality, steps: step, converged: true }

    if size <= config.targetSizeBytes:
      // Track best result at or below target (maximize quality)
      if bestResult == null OR quality > bestResult.quality:
        bestResult = { blob, sizeBytes: size, quality, steps: step }

    if size > config.targetSizeBytes:
      high = quality
      quality = (low + quality) / 2
    else if size < config.toleranceLowerBound:
      low = quality
      quality = (quality + high) / 2

  return { ...bestResult, converged: false }
```

### Target Size Store

```typescript
const TARGET_SIZE_KEY = 'image-compressor-target-size';
const DEFAULT_TARGET_KB = 400;
const MIN_TARGET_KB = 10;
const MAX_TARGET_KB = 10000;

function loadTargetSize(): number;    // from localStorage, fallback to default
function saveTargetSize(kb: number): void;
function validateTargetSize(value: string): { valid: boolean; kb?: number; error?: string };
```

### Compression Queue

```typescript
interface QueueState {
  items: QueueItem[];
  currentIndex: number;
  isProcessing: boolean;
}

interface QueueItem {
  id: string;
  file: File;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: CompressionProgress;
  result?: CompressionResult;
  error?: string;
  originalUrl: string;
  compressedUrl?: string;
}
```

Managed via React state (useReducer). Files are processed sequentially — when one completes, the next begins automatically.

### Download Manager

```typescript
function downloadSingle(result: CompressionResult, originalName: string): void;
// Creates object URL, triggers <a download> click, revokes URL

async function downloadAll(items: CompletedQueueItem[]): Promise<void>;
// Uses fflate to create ZIP, triggers download
```

File naming: `{name}_compressed.jpg` for individual files (all output is JPEG regardless of input format), `compressed_images.zip` for bulk.

### React Components

| Component | Responsibility |
|-----------|---------------|
| `App` | Root layout, holds queue state and target size state |
| `DropZone` | Drag-and-drop area + click-to-select, calls file validator |
| `TargetSizeInput` | Numeric input with validation, persists to localStorage |
| `CompressionQueue` | Renders list of QueueItems with progress/results |
| `QueueItem` | Single item: progress bar during compression, preview after |
| `PreviewPanel` | Side-by-side (or stacked) original vs compressed with metadata |
| `DownloadButton` | Individual download trigger |
| `DownloadAllButton` | Bulk ZIP download trigger, visible when 2+ results exist |

## Data Models

### Core Types

```typescript
type ImageFormat = 'image/jpeg' | 'image/png' | 'image/heic' | 'image/heif' | 'image/bmp';

interface ValidImageFile {
  file: File;
  format: ImageFormat;
  alreadyUnderTarget: boolean;
}

interface RejectedFile {
  file: File;
  reason: string;
}

interface CompressionConfig {
  targetSizeBytes: number;
  toleranceLowerBound: number;
  toleranceUpperBound: number;
  maxSteps: number;
  initialQuality: number;
}

interface CompressionProgress {
  step: number;
  maxSteps: number;
  currentSizeBytes: number;
  currentQuality: number;
}

interface CompressionResult {
  blob: Blob;
  sizeBytes: number;
  quality: number;
  steps: number;
  converged: boolean;
}

interface QueueItem {
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
```

### State Shape

```typescript
interface AppState {
  targetSizeKB: number;
  queue: QueueItem[];
  currentIndex: number;
  isProcessing: boolean;
}
```

State is managed with `useReducer` in the `App` component. Actions include `ADD_FILES`, `START_PROCESSING`, `UPDATE_PROGRESS`, `COMPLETE_ITEM`, `FAIL_ITEM`, `SKIP_ITEM`, `CLEAR_QUEUE`.


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Unsupported format rejection

*For any* file with a MIME type not in the supported set (image/jpeg, image/png, image/heic, image/heif, image/bmp), the file validator should reject the file and produce an error message containing the unsupported format name.

**Validates: Requirements 1.4**

### Property 2: Already-under-target detection

*For any* file and target size where the file's size in bytes is less than or equal to the target size in bytes, the file validator should mark the file as `alreadyUnderTarget: true` rather than rejecting it.

**Validates: Requirements 1.5**

### Property 3: Target size localStorage round trip

*For any* valid target size (integer between 10 and 10,000), saving it to localStorage and then loading it should return the same value.

**Validates: Requirements 2.3**

### Property 4: Target size validation rejects invalid inputs

*For any* string that is either non-numeric, empty, represents a number less than 10, or represents a number greater than 10,000, the `validateTargetSize` function should return `{ valid: false }` with an error message.

**Validates: Requirements 2.4, 2.5**

### Property 5: Binary search convergence maximizes quality within tolerance

*For any* monotonically decreasing encoding function (where higher quality produces larger output) and any target size where a solution exists within the tolerance range, the compress function should return a result where: (a) the output size is within the tolerance range (95%–99% of target), and (b) the quality parameter is the highest value achievable within that range, within the precision afforded by the maximum number of steps.

**Validates: Requirements 3.2, 3.3, 3.4, 3.5**

### Property 6: Compression progress callbacks are complete

*For any* compression run that takes N steps, the `onProgress` callback should be called exactly N times, and each call should contain a valid step number (1 through N), the maximum step count, the current file size in bytes (greater than 0), and the current quality parameter (between 0.0 and 1.0).

**Validates: Requirements 5.1, 5.2**

### Property 7: Preview metadata completeness

*For any* CompressionResult, the rendered preview metadata should contain the original file size, the compressed file size, the compression ratio, and the quality parameter used.

**Validates: Requirements 4.2**

### Property 8: Download file naming pattern

*For any* original filename with an extension, the generated download filename should follow the pattern `{name}_compressed.jpg` where `{name}` is the original filename without its extension.

**Validates: Requirements 4.5**

### Property 9: ZIP archive completeness

*For any* set of N completed compression results (N ≥ 2), the generated ZIP archive should contain exactly N entries, and each entry's filename should match the expected naming pattern.

**Validates: Requirements 4.4**

### Property 10: Batch sequential processing order

*For any* batch of N image files added to the queue, the files should be processed in the order they were added, and at most one file should be in the `processing` state at any time.

**Validates: Requirements 6.1**

### Property 11: Batch failure isolation

*For any* batch of N image files where file at index K fails compression (0 ≤ K < N), all files at indices other than K should still be processed to completion (either `completed` or `failed` on their own merits).

**Validates: Requirements 6.3**

## Error Handling

| Error Scenario | Handling Strategy | User Feedback |
|---|---|---|
| Unsupported file format | Reject at validation, do not queue | Toast/inline error: "Unsupported format: {mime_type}. Supported: JPEG, PNG, HEIC, HEIF, BMP" |
| File already under target | Mark as skipped, do not compress | Inline badge: "Already under {target}KB — no compression needed" |
| Invalid target size input | Reject, retain previous value | Inline validation error below input field |
| Canvas encoding failure | Catch error, mark queue item as failed | Item-level error: "Compression failed: {error_message}" |
| HEIC decoding failure | Catch heic2any error, mark as failed | Item-level error: "Could not decode HEIC file: {error_message}" |
| Max iterations reached | Return best result, flag as non-converged | Warning badge: "Could not reach exact target — closest result: {size}KB at quality {q}" |
| ZIP creation failure | Catch fflate error, show error | Toast: "Failed to create ZIP archive" |
| Browser lacks Canvas support | Detect on load, show unsupported message | Full-page message: "Your browser does not support the required Canvas API" |

All errors are non-fatal at the application level. Individual file failures do not block batch processing. The application never enters an unrecoverable state.

## Testing Strategy

### Unit Tests

Unit tests cover specific examples, edge cases, and error conditions:

- **File Validator**: Test with specific MIME types (supported and unsupported), empty files, files at exact boundary sizes
- **Target Size Validation**: Test with specific values at boundaries (10, 10000), empty string, non-numeric strings, negative numbers
- **Compressor Edge Cases**: Max iterations reached, image already in tolerance range on first try, quality 0.0 still too large
- **Download Naming**: Filenames with multiple dots, no extension, special characters
- **Queue Reducer**: Each action type with specific state transitions

### Property-Based Tests

Property-based tests use `fast-check` to verify universal properties across randomly generated inputs. Each property test maps to a correctness property defined above.

**Configuration**:
- Library: `fast-check` (TypeScript-native, integrates with Vitest)
- Minimum iterations: 100 per property
- Each test is tagged with: `Feature: image-compressor, Property {N}: {title}`

**Property Test Plan**:

| Property | Generator Strategy | Key Assertion |
|---|---|---|
| P1: Format rejection | Random strings as MIME types, excluding supported set | `validateFiles` rejects with error message |
| P2: Under-target detection | Random file sizes and target sizes where file < target | `alreadyUnderTarget === true` |
| P3: localStorage round trip | Random integers 10–10000 | `load(save(x)) === x` |
| P4: Validation rejection | Random non-numeric strings + numbers outside 10–10000 | `valid === false` |
| P5: Binary search convergence | Mock encoder with monotonic `f(q) = baseSize * q`, random target sizes | Result in tolerance range, quality is maximal |
| P6: Progress callbacks | Mock encoder, random step counts | Callback count === steps, all fields valid |
| P7: Metadata completeness | Random CompressionResult objects | Rendered output contains all four fields |
| P8: File naming | Random filenames with various extensions | Output matches `{name}_compressed.jpg` |
| P9: ZIP completeness | Random arrays of 2–10 blobs with names | ZIP entry count === input count |
| P10: Sequential processing | Random batches of 2–10 items | At most 1 processing at a time, order preserved |
| P11: Failure isolation | Random batches with random failure index | All non-failed items reach completion |

### Test Organization

```
src/
  __tests__/
    fileValidator.test.ts        # Unit + P1, P2
    targetSize.test.ts           # Unit + P3, P4
    compressor.test.ts           # Unit + P5, P6
    downloadManager.test.ts      # Unit + P8, P9
    previewPanel.test.ts         # Unit + P7
    compressionQueue.test.ts     # Unit + P10, P11
```
