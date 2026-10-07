import type { BookFormat } from "./types";
import { getPdfWorker } from "./pdfWorker";

export async function analyzeDocument(file: File, format: BookFormat): Promise<number> {
  const buffer = await file.arrayBuffer();
  if (format === "pdf") {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerPort = getPdfWorker();
    const document = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
    try {
      return document.numPages;
    } finally {
      await document.destroy();
    }
  }

  const { default: ePub } = await import("epubjs");
  const book = ePub(buffer);
  try {
    await book.ready;
    return Math.max(1, (await book.loaded.spine).length);
  } finally {
    await book.destroy();
  }
}
