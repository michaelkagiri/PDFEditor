import { PDFDocument } from 'pdf-lib';
import { parsePages, load, newDoc, copyInto, baseName } from './pdf.js';
import { forEachPage, canvasBytes, extractText } from './render.js';
import SignPad from './SignPad.jsx';
import SignPlacer from './SignPlacer.jsx';

// Same entry format as TOOLS in tools.js. tools.js appends these to the list.
export const MORE_TOOLS = [
  {
    id: 'crop',
    name: 'Crop PDF',
    types: 'PDF',
    accept: 'application/pdf',
    action: 'Crop',
    lede: 'Trim the same margin from every page. The trimmed area is hidden, not deleted.',
    opts: [{ key: 'margin', label: 'Margin to trim, in points', type: 'text', value: '20', placeholder: '20' }],
    run: async ([f], o) => {
      const m = Number(o.margin);
      if (!(m >= 0)) throw new Error('Enter a margin in points, such as 20.');
      const doc = await load(f);
      for (const p of doc.getPages()) {
        const { x, y, width, height } = p.getMediaBox();
        if (width <= 2 * m || height <= 2 * m) throw new Error('The margin is larger than some pages.');
        p.setCropBox(x + m, y + m, width - 2 * m, height - 2 * m);
      }
      return [{ name: `${baseName(f.name)}-cropped.pdf`, bytes: await doc.save() }];
    },
  },

  {
    id: 'organize',
    name: 'Organize pages',
    types: 'PDF',
    accept: 'application/pdf',
    action: 'Save order',
    lede: 'Set the page order. Repeat a page number to copy it, and leave a page out to remove it.',
    opts: [{ key: 'order', label: 'New page order', type: 'text', placeholder: '3, 1, 2, 2' }],
    run: async ([f], o) => {
      const src = await load(f);
      const order = parsePages(o.order, src.getPageCount()).flat();
      if (!order.length) throw new Error('Enter the new order, such as 3, 1, 2.');
      const out = await newDoc();
      await copyInto(out, src, order);
      return [{ name: `${baseName(f.name)}-organized.pdf`, bytes: await out.save() }];
    },
  },

  {
    id: 'compress',
    name: 'Compress PDF',
    types: 'PDF',
    accept: 'application/pdf',
    action: 'Compress',
    lede: 'Redraws each page as a JPEG. Text stops being selectable, and small files can end up larger.',
    opts: [
      {
        key: 'quality',
        label: 'Image quality',
        type: 'select',
        options: [['0.85', 'High'], ['0.6', 'Medium'], ['0.35', 'Smallest']],
      },
    ],
    run: async ([f], o) => {
      const out = await newDoc();
      await forEachPage(f.bytes, 1.5, async (canvas, _i, w, h) => {
        const img = await out.embedJpg(await canvasBytes(canvas, 'image/jpeg', Number(o.quality)));
        out.addPage([w, h]).drawImage(img, { x: 0, y: 0, width: w, height: h });
      });
      return [{ name: `${baseName(f.name)}-compressed.pdf`, bytes: await out.save() }];
    },
  },

  {
    id: 'topng',
    name: 'PDF to JPG/PNG',
    types: 'PDF',
    accept: 'application/pdf',
    action: 'Convert',
    lede: 'Save every page as an image. Each page becomes its own download.',
    opts: [{ key: 'format', label: 'Image format', type: 'select', options: [['jpg', 'JPG'], ['png', 'PNG']] }],
    run: async ([f], o) => {
      const type = o.format === 'png' ? 'image/png' : 'image/jpeg';
      const outs = [];
      await forEachPage(f.bytes, 2, async (canvas, i) => {
        outs.push({
          name: `${baseName(f.name)}-page-${i}.${o.format}`,
          type,
          bytes: await canvasBytes(canvas, type, 0.92),
        });
      });
      return outs;
    },
  },

  {
    id: 'text',
    name: 'Extract Text',
    types: 'PDF',
    accept: 'application/pdf',
    action: 'Extract',
    lede: 'Copy the text from every page into one .txt file. Scanned pages come out empty, because they hold images rather than text.',
    run: async ([f]) => {
      const text = await extractText(f.bytes);
      return [{ name: `${baseName(f.name)}.txt`, type: 'text/plain', bytes: new TextEncoder().encode(text) }];
    },
  },

  {
    id: 'repair',
    name: 'Repair PDF',
    types: 'PDF',
    accept: 'application/pdf',
    action: 'Repair',
    lede: 'Reads the file leniently and writes a clean copy. Badly damaged files may still fail.',
    run: async ([f]) => {
      const doc = await PDFDocument.load(f.bytes, { throwOnInvalidObject: false });
      return [{ name: `${baseName(f.name)}-repaired.pdf`, bytes: await doc.save() }];
    },
  },

  {
    id: 'sign',
    name: 'Sign PDF',
    types: 'PDF',
    accept: 'application/pdf',
    action: 'Sign',
    lede: 'Draw your signature, then drag it to where you want it on the page.',
    Pad: SignPad,
    Place: SignPlacer,
    run: async ([f], o) => {
      if (!o.sig || !o.place) throw new Error('Draw your signature and place it on a page first.');
      const doc = await load(f);
      const png = await doc.embedPng(o.sig);
      const page = doc.getPage(o.place.page - 1);
      const { width: W, height: H } = page.getSize();
      const w = o.place.w * W;
      const h = w * (png.height / png.width);
      const x = o.place.x * W;
      const y = H - o.place.y * H - h;
      page.drawImage(png, { x, y, width: w, height: h });
      return [{ name: `${baseName(f.name)}-signed.pdf`, bytes: await doc.save() }];
    },
  },
];
