export interface EncodingEngine {
  encode(image: ImageBitmap, quality: number): Promise<Blob>;
}
