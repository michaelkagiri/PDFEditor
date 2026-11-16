import { PDFDocument } from 'pdf-lib';

// "1-3, 5" -> [[0, 1, 2], [4]]. Each comma-separated part becomes one group of 0-based page indexes.
export function parsePages(text, pageCount) {
  return text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [a, b = a] = s.split('-').map((x) => parseInt(x, 10));
      if (!(a >= 1 && b >= a && b <= pageCount)) {
        throw new Error(`"${s}" is not a page range in this ${pageCount}-page file.`);
      }
      return Array.from({ length: b - a + 1 }, (_, i) => a - 1 + i);
    });
}

export const load = (file) => PDFDocument.load(file.bytes);

export const newDoc = () => PDFDocument.create();

export async function copyInto(out, src, indexes) {
  const pages = await out.copyPages(src, indexes);
  pages.forEach((p) => out.addPage(p));
}

export const baseName = (name) => name.replace(/\.[^.]+$/, '');

export function formatSize(bytes) {
  return bytes > 1048576
    ? `${(bytes / 1048576).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
