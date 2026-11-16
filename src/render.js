import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

// Renders each page to a white-backed canvas, one at a time, to keep memory low.
// fn receives (canvas, pageNumber, widthInPoints, heightInPoints).
export async function forEachPage(bytes, scale, fn) {
  const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      await fn(canvas, i, viewport.width / scale, viewport.height / scale);
    }
  } finally {
    doc.destroy();
  }
}

export function canvasBytes(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) return reject(new Error('Could not encode the page image.'));
      resolve(new Uint8Array(await blob.arrayBuffer()));
    }, type, quality);
  });
}

export const openPdf = (bytes) => pdfjs.getDocument({ data: bytes.slice() }).promise;

export async function extractText(bytes) {
  const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  const pages = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const content = await (await doc.getPage(i)).getTextContent();
      const text = content.items
        .filter((it) => 'str' in it)
        .map((it) => it.str + (it.hasEOL ? '\n' : ' '))
        .join('')
        .trim();
      pages.push(`--- Page ${i} ---\n${text}`);
    }
  } finally {
    doc.destroy();
  }
  return pages.join('\n\n');
}
