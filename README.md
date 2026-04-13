# Image Compressor

A client-side image compression app that shrinks images to a precise target file size using a binary-search algorithm over JPEG quality. All processing happens in the browser — no data ever leaves your device.

## Features

- Drag-and-drop or click to upload (JPEG, PNG, HEIC, HEIF, BMP)
- Configurable target file size (10–10,000 KB, persisted in localStorage)
- Binary-search compression for optimal quality within your size constraint
- Batch processing with per-file progress indicators
- Side-by-side original vs compressed preview with metadata
- Individual download or bulk ZIP download
- Fully responsive (mobile, tablet, desktop)
- Deployable as a static site (Cloudflare Pages ready)

## Tech Stack

- React 19, TypeScript, Vite 8
- Tailwind CSS 4
- Canvas API for JPEG encoding
- `heic2any` for HEIC/HEIF decoding
- `fflate` for ZIP packaging
- Vitest + fast-check for unit and property-based tests

## Getting Started

```bash
# Install dependencies
bun install

# Start dev server
bun run dev

# Run tests
bun run test

# Production build
bun run build
```

## License

MIT
