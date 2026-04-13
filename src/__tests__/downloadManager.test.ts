import { describe, it, expect } from 'vitest';
import { generateFilename } from '../utils/downloadManager';

describe('generateFilename', () => {
  it('strips extension and appends _compressed.jpg', () => {
    expect(generateFilename('photo.png')).toBe('photo_compressed.jpg');
  });

  it('handles .jpg extension', () => {
    expect(generateFilename('image.jpg')).toBe('image_compressed.jpg');
  });

  it('handles .jpeg extension', () => {
    expect(generateFilename('scan.jpeg')).toBe('scan_compressed.jpg');
  });

  it('handles filenames with multiple dots', () => {
    expect(generateFilename('my.vacation.photo.png')).toBe('my.vacation.photo_compressed.jpg');
  });

  it('handles filenames with no extension', () => {
    expect(generateFilename('noextension')).toBe('noextension_compressed.jpg');
  });

  it('handles .heic extension', () => {
    expect(generateFilename('IMG_0001.heic')).toBe('IMG_0001_compressed.jpg');
  });

  it('handles .bmp extension', () => {
    expect(generateFilename('screenshot.bmp')).toBe('screenshot_compressed.jpg');
  });

  it('handles filenames starting with a dot (hidden files)', () => {
    expect(generateFilename('.hidden.png')).toBe('.hidden_compressed.jpg');
  });

  it('handles single-character base name', () => {
    expect(generateFilename('a.png')).toBe('a_compressed.jpg');
  });
});
