# Requirements Document

## Introduction

A high-performance, type-safe, frontend-only single-page web application for image compression. The application enables users (primarily medical professionals) to compress images to a precise target file size using a binary-search compression algorithm. All processing occurs client-side in the browser with no server involvement. The application is designed for daily use with minimal interaction, supporting drag-and-drop workflows and responsive layouts for mobile and tablet devices.

## Glossary

- **Compressor**: The core module responsible for iteratively compressing an image to reach a target file size within an acceptable tolerance range while maximizing visual quality.
- **Encoding_Engine**: The underlying image encoding implementation, which may use the browser Canvas API, WebAssembly-based codecs (e.g., libmozjpeg, libwebp), or OffscreenCanvas for optimal performance and quality.
- **Target_Size**: The desired output file size in kilobytes specified by the user.
- **Tolerance_Range**: The acceptable output size window, defined as 1–5% below the Target_Size (e.g., for a 400KB target, the acceptable range is 380KB–396KB).
- **Compression_Step**: A single iteration of the binary-search algorithm that adjusts the quality parameter and re-encodes the image.
- **Quality_Parameter**: A numeric value (0.0–1.0) controlling the lossy compression level applied during image encoding.
- **Image_Input**: A user-provided image file in a supported format (JPEG, JPG, PNG, HEIC, HEIF, or BMP).
- **Compressed_Output**: The resulting image blob after the Compressor has reached the Tolerance_Range.
- **Drop_Zone**: The UI region where users can drag-and-drop or click to select Image_Input files.
- **Preview_Panel**: The UI component that displays the original and compressed image side by side with metadata.
- **Application**: The complete single-page web application comprising the Drop_Zone, Compressor, and Preview_Panel.

## Requirements

### Requirement 1: Image Upload

**User Story:** As a medical professional, I want to upload images via drag-and-drop or file selection, so that I can quickly begin the compression workflow without unnecessary steps.

#### Acceptance Criteria

1. WHEN a user drags one or more image files onto the Drop_Zone, THE Application SHALL accept the files and begin processing each Image_Input.
2. WHEN a user clicks the Drop_Zone, THE Application SHALL open a native file picker filtered to supported image formats (JPEG, JPG, PNG, HEIC, HEIF, BMP).
3. WHEN a user selects one or more files from the file picker, THE Application SHALL accept the files and begin processing each Image_Input.
4. IF a user provides a file that is not a supported image format, THEN THE Application SHALL reject the file and display a descriptive error message identifying the unsupported format.
5. IF a user provides a file that is already smaller than the Target_Size, THEN THE Application SHALL skip compression and notify the user that the file is already within the target.

### Requirement 2: Target Size Configuration

**User Story:** As a user, I want to specify the target file size for compression, so that I can meet specific upload size requirements for my workflow.

#### Acceptance Criteria

1. THE Application SHALL provide a numeric input field for the user to specify the Target_Size in kilobytes.
2. THE Application SHALL default the Target_Size to 400 kilobytes.
3. WHEN the user changes the Target_Size, THE Application SHALL persist the value in browser local storage for future sessions.
4. IF the user enters a Target_Size that is less than 10 kilobytes or greater than 10,000 kilobytes, THEN THE Application SHALL reject the value and display a validation error.
5. IF the user enters a non-numeric or empty value for Target_Size, THEN THE Application SHALL reject the value and retain the previous valid Target_Size.

### Requirement 3: Binary-Search Compression Algorithm

**User Story:** As a user, I want images compressed to land precisely within a small range below my target size while preserving the highest possible visual quality, so that I get the best-looking image that still meets the size constraint.

#### Acceptance Criteria

1. WHEN the Compressor receives an Image_Input and a Target_Size, THE Compressor SHALL encode the image using the Encoding_Engine with an initial Quality_Parameter of 0.7.
2. THE Compressor SHALL use a binary-search strategy over the Quality_Parameter range (0.0–1.0) to converge on the highest Quality_Parameter that produces a Compressed_Output within the Tolerance_Range.
3. WHEN a Compression_Step produces output larger than the Target_Size, THE Compressor SHALL reduce the Quality_Parameter by halving the remaining upper range.
4. WHEN a Compression_Step produces output smaller than the lower bound of the Tolerance_Range, THE Compressor SHALL increase the Quality_Parameter by halving the remaining lower range.
5. WHEN a Compression_Step produces output within the Tolerance_Range, THE Compressor SHALL stop and return the Compressed_Output with the current Quality_Parameter.
6. IF the Compressor reaches a maximum of 20 Compression_Steps without converging, THEN THE Compressor SHALL return the result with the highest Quality_Parameter that was still at or below the Target_Size, and notify the user.
7. THE Compressor SHALL prefer the Encoding_Engine implementation that produces the highest visual quality at a given file size (WebAssembly codecs over Canvas API when available).
8. THE Compressor SHALL perform all encoding operations locally in the browser without transmitting data to any external server.

### Requirement 4: Compression Output and Download

**User Story:** As a user, I want to preview and download compressed images immediately, so that I can verify quality and use the files right away.

#### Acceptance Criteria

1. WHEN the Compressor produces a Compressed_Output, THE Preview_Panel SHALL display the original image and the Compressed_Output side by side.
2. WHEN the Compressor produces a Compressed_Output, THE Preview_Panel SHALL display the original file size, the compressed file size, the compression ratio, and the Quality_Parameter used.
3. THE Application SHALL provide a download button for each Compressed_Output that triggers a browser file download.
4. WHEN multiple images are compressed, THE Application SHALL provide a "Download All" button that packages all Compressed_Outputs into a single ZIP archive for download.
5. THE Application SHALL name downloaded files using the pattern `{original_filename}_compressed.{extension}`.

### Requirement 5: Compression Progress Feedback

**User Story:** As a user, I want to see real-time progress during compression, so that I know the application is working and can estimate wait time.

#### Acceptance Criteria

1. WHILE the Compressor is processing an Image_Input, THE Application SHALL display a progress indicator showing the current Compression_Step number out of the maximum (20).
2. WHILE the Compressor is processing an Image_Input, THE Application SHALL display the current file size of the intermediate result after each Compression_Step.
3. WHEN the Compressor completes processing, THE Application SHALL replace the progress indicator with the final compression result summary.

### Requirement 6: Batch Processing

**User Story:** As a medical professional, I want to drop multiple images at once and have them all compressed automatically, so that I can process my daily uploads efficiently.

#### Acceptance Criteria

1. WHEN a user provides multiple Image_Inputs simultaneously, THE Application SHALL queue all files and process them sequentially.
2. WHILE batch processing is active, THE Application SHALL display the overall batch progress (e.g., "3 of 10 images completed").
3. IF one Image_Input in a batch fails compression, THEN THE Application SHALL continue processing the remaining files and report the failure for the specific file.

### Requirement 7: Responsive Design

**User Story:** As a user, I want the application to work well on mobile phones and tablets, so that I can compress images from any device.

#### Acceptance Criteria

1. THE Application SHALL render a usable layout on viewport widths from 320 pixels to 2560 pixels.
2. WHEN the viewport width is below 768 pixels, THE Application SHALL stack the original and compressed image previews vertically instead of side by side.
3. THE Drop_Zone SHALL occupy a minimum touch target of 48 by 48 CSS pixels on all viewport sizes.

### Requirement 8: Client-Side Only Processing

**User Story:** As a user handling sensitive medical images, I want all processing to happen locally in my browser, so that no image data leaves my device.

#### Acceptance Criteria

1. THE Application SHALL perform all image encoding, decoding, and compression operations using browser-native APIs (Canvas API, Blob API, File API) or WebAssembly-based codecs running locally in the browser.
2. THE Application SHALL not make any network requests containing image data or image metadata.
3. THE Application SHALL function fully when the device has no active internet connection after initial page load.

### Requirement 9: Static Deployment Compatibility

**User Story:** As a developer, I want the application to be deployable as a static site, so that I can host it on Cloudflare Pages with zero server configuration.

#### Acceptance Criteria

1. THE Application SHALL produce a static build output consisting only of HTML, CSS, JavaScript, and static asset files.
2. THE Application SHALL require no server-side runtime or API endpoints to function.
3. THE Application SHALL use hash-based or content-addressed filenames for cache-busting in production builds.
