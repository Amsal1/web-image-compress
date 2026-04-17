import { describe, it, expect } from 'vitest';
import { validateFiles } from '../utils/fileValidator';

function makeFile(name: string, type: string, size: number): File {
  const buffer = new ArrayBuffer(size);
  return new File([buffer], name, { type });
}

describe('validateFiles', () => {
  it('accepts supported MIME types', async () => {
    const files = [
      makeFile('photo.jpg', 'image/jpeg', 500_000),
      makeFile('photo.png', 'image/png', 500_000),
      makeFile('photo.heic', 'image/heic', 500_000),
      makeFile('photo.heif', 'image/heif', 500_000),
      makeFile('photo.bmp', 'image/bmp', 500_000),
    ];
    const result = await validateFiles(files, 400_000);
    expect(result.valid).toHaveLength(5);
    expect(result.rejected).toHaveLength(0);
  });

  it('rejects unsupported MIME types with descriptive message', async () => {
    const file = makeFile('doc.pdf', 'application/pdf', 1000);
    const result = await validateFiles([file], 400_000);
    expect(result.valid).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].reason).toContain('application/pdf');
    expect(result.rejected[0].reason).toContain('Supported: JPEG, PNG, HEIC, HEIF, BMP');
  });

  it('handles files with empty MIME type', async () => {
    const file = makeFile('mystery', '', 1000);
    const result = await validateFiles([file], 400_000);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].reason).toContain('unknown');
  });

  it('flags files smaller than or equal to target as alreadyUnderTarget', async () => {
    const small = makeFile('tiny.jpg', 'image/jpeg', 100);
    const exact = makeFile('exact.jpg', 'image/jpeg', 400_000);
    const result = await validateFiles([small, exact], 400_000);
    expect(result.valid).toHaveLength(2);
    expect(result.valid[0].alreadyUnderTarget).toBe(true);
    expect(result.valid[1].alreadyUnderTarget).toBe(true);
  });

  it('does not flag files larger than target as alreadyUnderTarget', async () => {
    const large = makeFile('big.jpg', 'image/jpeg', 500_000);
    const result = await validateFiles([large], 400_000);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].alreadyUnderTarget).toBe(false);
  });

  it('handles a mix of valid and invalid files', async () => {
    const files = [
      makeFile('photo.jpg', 'image/jpeg', 500_000),
      makeFile('doc.pdf', 'application/pdf', 1000),
      makeFile('small.png', 'image/png', 100),
    ];
    const result = await validateFiles(files, 400_000);
    expect(result.valid).toHaveLength(2);
    expect(result.rejected).toHaveLength(1);
    expect(result.valid[1].alreadyUnderTarget).toBe(true);
  });

  it('returns empty arrays for empty input', async () => {
    const result = await validateFiles([], 400_000);
    expect(result.valid).toHaveLength(0);
    expect(result.rejected).toHaveLength(0);
  });

  it('preserves the correct format on valid files', async () => {
    const file = makeFile('photo.png', 'image/png', 500_000);
    const result = await validateFiles([file], 400_000);
    expect(result.valid[0].format).toBe('image/png');
  });
});
