import { StandardFonts, rgb, degrees } from 'pdf-lib';
import { parsePages, load, newDoc, copyInto, baseName } from './pdf.js';
import { MORE_TOOLS } from './moreTools.js';

// Each tool: UI metadata plus run(files, options) -> [{ name, bytes }].
// To add a tool, append an entry here. The panel renders it automatically.
const BASE_TOOLS = [
  {
    id: 'merge',
    name: 'Merge PDFs',
    types: 'PDF',
    accept: 'application/pdf',
    multi: true,
    min: 2,
    action: 'Merge',
    lede: 'Join PDFs into one file, in the order listed. Use the arrows to reorder.',
    run: async (files) => {
      const out = await newDoc();
      for (const f of files) {
        const src = await load(f);
        await copyInto(out, src, src.getPageIndices());
      }
      return [{ name: 'merged.pdf', bytes: await out.save() }];
    },
  },

  {
    id: 'split',
    name: 'Split PDF',
    types: 'PDF',
    accept: 'application/pdf',
    action: 'Split',
    lede: 'Save page ranges as separate PDFs. Leave the field empty to get one file per page.',
    opts: [{ key: 'ranges', label: 'Page ranges, each becomes one file', type: 'text', placeholder: '1-3, 4, 5-7' }],
    run: async ([f], o) => {
      const src = await load(f);
      const count = src.getPageCount();
      const base = baseName(f.name);
      const groups = o.ranges.trim()
        ? parsePages(o.ranges, count)
        : Array.from({ length: count }, (_, i) => [i]);

      const outs = [];
      for (const g of groups) {
        const out = await newDoc();
        await copyInto(out, src, g);
        const label = g.length > 1 ? `${g[0] + 1}-${g[g.length - 1] + 1}` : `${g[0] + 1}`;
        outs.push({ name: `${base}-pages-${label}.pdf`, bytes: await out.save() });
      }
      return outs;
    },
  },

  {
    id: 'rotate',
    name: 'Rotate PDF',
    types: 'PDF',
    accept: 'application/pdf',
    action: 'Rotate',
    lede: 'Turn every page of a PDF by a quarter or half turn.',
    opts: [
      {
        key: 'deg',
        label: 'Rotation',
        type: 'select',
        options: [
          ['90', '90° clockwise'],
          ['180', '180°'],
          ['270', '90° counterclockwise'],
        ],
      },
    ],
    run: async ([f], o) => {
      const doc = await load(f);
      doc.getPages().forEach((p) => {
        p.setRotation(degrees((p.getRotation().angle + Number(o.deg)) % 360));
      });
      return [{ name: `${baseName(f.name)}-rotated.pdf`, bytes: await doc.save() }];
    },
  },

  {
    id: 'delete',
    name: 'Delete pages',
    types: 'PDF',
    accept: 'application/pdf',
    action: 'Delete pages',
    lede: 'Remove pages you do not need. The remaining pages keep their order.',
    opts: [{ key: 'pages', label: 'Pages to delete', type: 'text', placeholder: '2, 4-6' }],
    run: async ([f], o) => {
      if (!o.pages.trim()) throw new Error('Enter the pages to delete, such as 2 or 4-6.');
      const src = await load(f);
      const drop = new Set(parsePages(o.pages, src.getPageCount()).flat());
      const keep = src.getPageIndices().filter((i) => !drop.has(i));
      if (!keep.length) throw new Error('You cannot delete every page.');

      const out = await newDoc();
      await copyInto(out, src, keep);
      return [{ name: `${baseName(f.name)}-edited.pdf`, bytes: await out.save() }];
    },
  },

  {
    id: 'img',
    name: 'Image to PDF',
    types: 'JPG or PNG',
    accept: 'image/jpeg,image/png',
    multi: true,
    action: 'Make PDF',
    lede: 'Put images into one PDF. Each page is sized to its image.',
    run: async (files) => {
      const out = await newDoc();
      for (const f of files) {
        const img = f.type === 'image/png' ? await out.embedPng(f.bytes) : await out.embedJpg(f.bytes);
        out.addPage([img.width, img.height]).drawImage(img, {
          x: 0,
          y: 0,
          width: img.width,
          height: img.height,
        });
      }
      return [{ name: 'images.pdf', bytes: await out.save() }];
    },
  },

  {
    id: 'num',
    name: 'Page numbers',
    types: 'PDF',
    accept: 'application/pdf',
    action: 'Add numbers',
    lede: 'Stamp a page count on every page, like 2 of 12.',
    opts: [
      {
        key: 'pos',
        label: 'Position',
        type: 'select',
        options: [
          ['c', 'Bottom centre'],
          ['r', 'Bottom right'],
        ],
      },
    ],
    run: async ([f], o) => {
      const doc = await load(f);
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const total = doc.getPageCount();

      doc.getPages().forEach((p, i) => {
        const { width } = p.getSize();
        const text = `${i + 1} of ${total}`;
        const size = 10;
        const w = font.widthOfTextAtSize(text, size);
        p.drawText(text, {
          x: o.pos === 'r' ? width - 40 - w : (width - w) / 2,
          y: 24,
          size,
          font,
          color: rgb(0.3, 0.3, 0.3),
        });
      });
      return [{ name: `${baseName(f.name)}-numbered.pdf`, bytes: await doc.save() }];
    },
  },

  {
    id: 'wm',
    name: 'Watermark',
    types: 'PDF',
    accept: 'application/pdf',
    action: 'Add watermark',
    lede: 'Print a diagonal text mark across every page.',
    opts: [{ key: 'text', label: 'Watermark text', type: 'text', value: 'CONFIDENTIAL', placeholder: 'CONFIDENTIAL' }],
    run: async ([f], o) => {
      if (!o.text.trim()) throw new Error('Enter the watermark text.');
      const doc = await load(f);
      const font = await doc.embedFont(StandardFonts.Helvetica);

      doc.getPages().forEach((p) => {
        const { width: w, height: h } = p.getSize();
        const size = Math.min(w, h) / 9;
        // Offset so the text's centre lands on the page centre after a 45° rotation.
        const d = (font.widthOfTextAtSize(o.text, size) / 2) * Math.SQRT1_2;
        p.drawText(o.text, {
          x: w / 2 - d,
          y: h / 2 - d,
          size,
          font,
          rotate: degrees(45),
          color: rgb(0.5, 0.5, 0.5),
          opacity: 0.22,
        });
      });
      return [{ name: `${baseName(f.name)}-watermarked.pdf`, bytes: await doc.save() }];
    },
  },
];

export const TOOLS = [...BASE_TOOLS, ...MORE_TOOLS];
