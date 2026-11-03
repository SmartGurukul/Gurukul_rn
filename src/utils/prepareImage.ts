import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';

export interface PreparedImage {
  uri: string;
  contentType: 'image/jpeg' | 'image/png';
  sizeBytes: number;
}

interface PrepareOptions {
  /** Longest side, in pixels, after resizing. Smaller images are left at their size. */
  maxDimension: number;
  /** Keep a PNG source as PNG (for logos with transparent backgrounds); everything else becomes JPEG. */
  keepPng?: boolean;
  sourceContentType?: string | null;
}

/**
 * Turns whatever the user picked - HEIC, WebP, a 12 MP camera photo - into a small JPEG (or PNG)
 * the upload limits always accept, so a photo is never rejected for its format or size.
 */
export async function prepareImageForUpload(uri: string, options: PrepareOptions): Promise<PreparedImage> {
  const asPng = !!options.keepPng && options.sourceContentType === 'image/png';
  const context = ImageManipulator.manipulate(uri);
  let image = await context.renderAsync();
  const longest = Math.max(image.width, image.height);
  if (longest > options.maxDimension) {
    context.resize(image.width >= image.height ? { width: options.maxDimension } : { height: options.maxDimension });
    image = await context.renderAsync();
  }
  const saved = await image.saveAsync(asPng ? { format: SaveFormat.PNG } : { format: SaveFormat.JPEG, compress: 0.8 });
  return {
    uri: saved.uri,
    contentType: asPng ? 'image/png' : 'image/jpeg',
    // On web the result is a blob:/data: URI with no file on disk to measure.
    sizeBytes: Platform.OS === 'web' ? (await (await fetch(saved.uri)).blob()).size : new File(saved.uri).size,
  };
}
