import PdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?worker";

let sharedPdfWorker: Worker | undefined;

export function getPdfWorker(): Worker {
  sharedPdfWorker ??= new PdfWorker();
  return sharedPdfWorker;
}
