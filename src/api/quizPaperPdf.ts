import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { TFunction } from 'i18next';
import { Platform } from 'react-native';

import { buildQuizPaperHtml, quizPaperFileName } from '../utils/quizPaper';
import type { AiQuizGenerationResponse } from './types';

/** A4 at 72 PPI, the unit expo-print measures pages in. */
const A4_PAGE = { width: 595, height: 842 };

/** This device has no share sheet to hand the PDF to. */
export class ShareUnavailableError extends Error {
  constructor() {
    super('Sharing is not available on this device');
  }
}

/**
 * Renders the generated paper to a PDF on the phone (no network needed) and opens the share sheet.
 * `includeAnswerKey` adds the answer key on its own page(s) after the questions.
 */
export async function shareQuizPaper(paper: AiQuizGenerationResponse, includeAnswerKey: boolean, t: TFunction): Promise<void> {
  const html = buildQuizPaperHtml(paper, { includeAnswerKey }, t);
  if (Platform.OS === 'web') {
    // Browsers can't render HTML to a PDF file directly; the print dialog's "Save as PDF" does it.
    printHtmlInBrowser(html, quizPaperFileName(paper.title, paper.className, includeAnswerKey));
    return;
  }
  const { uri } = await Print.printToFileAsync({ html, ...A4_PAGE });

  // A readable file name for whoever receives it; the print file's own name is random.
  let shareUri = uri;
  try {
    const named = new File(Paths.cache, quizPaperFileName(paper.title, paper.className, includeAnswerKey));
    await new File(uri).move(named, { overwrite: true });
    shareUri = named.uri;
  } catch (e) {
    console.warn('[quizPaper] Could not rename the PDF, sharing it under its print name', e);
  }

  if (!(await Sharing.isAvailableAsync())) throw new ShareUnavailableError();
  await Sharing.shareAsync(shareUri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: paper.title });
}

/** Web: prints the paper from a hidden iframe so only the paper (not the app) is printed. */
function printHtmlInBrowser(html: string, fileName: string) {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  // The print dialog suggests the document title as the PDF's file name.
  frame.srcdoc = html.replace(/<title>[^<]*<\/title>/i, '').replace(/<head>/i, `<head><title>${fileName.replace(/\.pdf$/i, '').replace(/[<&]/g, '')}</title>`);
  frame.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 60_000);
  };
  document.body.appendChild(frame);
}
