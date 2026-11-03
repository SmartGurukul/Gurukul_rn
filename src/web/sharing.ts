/**
 * Web stand-in for expo-sharing. The app "shares" files it has just downloaded (report cards, ID
 * cards, receipts, attendance exports); in a browser the useful equivalent is saving the file, so
 * shareAsync triggers a download under the file's name. Wired in for web builds only, by metro.config.js.
 */
import { savedFileName } from './fileSystem';

export async function isAvailableAsync(): Promise<boolean> {
  return typeof document !== 'undefined';
}

export async function shareAsync(url: string, options: { mimeType?: string; dialogTitle?: string; UTI?: string } = {}) {
  const a = document.createElement('a');
  a.href = url;
  a.download = savedFileName(url) ?? options.dialogTitle ?? 'download';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
