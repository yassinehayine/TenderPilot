import { PDFParse } from 'pdf-parse';

export interface ExtractionResult {
  pageCount: number;
  pages: Array<{ page: number; text: string }>;
  unreadablePages: number[];
}

export async function extractPdfPages(buffer: Buffer): Promise<ExtractionResult> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const info = await parser.getInfo({ parsePageInfo: true });
    const textResult = await parser.getText();
    const pageCount = info.total || textResult.pages.length;
    const pages = Array.from({ length: pageCount }, (_, index) => ({
      page: index + 1,
      text: (textResult.pages[index]?.text ?? '').trim()
    }));
    return { pageCount, pages, unreadablePages: pages.filter((page) => page.text.length < 20).map((page) => page.page) };
  } finally {
    await parser.destroy();
  }
}