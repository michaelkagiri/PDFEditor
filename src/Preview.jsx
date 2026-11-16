import { useEffect, useRef, useState } from 'react';
import { openPdf } from './render.js';
import './preview.css';

const PREVIEW_WIDTH = 640;

function ImagePreview({ file }) {
  const [url, setUrl] = useState('');

  useEffect(() => {
    const u = URL.createObjectURL(new Blob([file.bytes], { type: file.type }));
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  return url ? <img className="page-img" src={url} alt={file.name} /> : null;
}

function PdfPreview({ file }) {
  const canvas = useRef(null);
  const task = useRef(null);
  const [doc, setDoc] = useState(null);
  const [page, setPage] = useState(1);
  const [err, setErr] = useState('');

  // Open the file when it is selected, and close it when the selection changes.
  useEffect(() => {
    let alive = true;
    let opened = null;
    setDoc(null);
    setPage(1);
    setErr('');
    openPdf(file.bytes)
      .then((d) => {
        if (!alive) return d.destroy();
        opened = d;
        setDoc(d);
      })
      .catch(() => {
        if (alive) setErr('This PDF could not be previewed. It may be password protected or damaged.');
      });
    return () => {
      alive = false;
      opened?.destroy();
    };
  }, [file]);

  // Draw the current page whenever the document or page number changes.
  useEffect(() => {
    if (!doc) return;
    (async () => {
      const pg = await doc.getPage(page);
      const base = pg.getViewport({ scale: 1 });
      const vp = pg.getViewport({ scale: PREVIEW_WIDTH / base.width });
      const c = canvas.current;
      c.width = Math.ceil(vp.width);
      c.height = Math.ceil(vp.height);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
      task.current?.cancel();
      task.current = pg.render({ canvasContext: ctx, viewport: vp });
      await task.current.promise;
    })().catch((e) => {
      if (e?.name !== 'RenderingCancelledException') setErr('This page could not be drawn.');
    });
    return () => {
      task.current?.cancel();
    };
  }, [doc, page]);

  if (err) return <p className="err">{err}</p>;
  const total = doc ? doc.numPages : 0;

  return (
    <>
      <div className="pager">
        <button className="small" disabled={!doc || page <= 1} onClick={() => setPage((p) => p - 1)}>
          Previous
        </button>
        <span>{doc ? `Page ${page} of ${total}` : 'Loading preview…'}</span>
        <button className="small" disabled={!doc || page >= total} onClick={() => setPage((p) => p + 1)}>
          Next
        </button>
      </div>
      <canvas ref={canvas} className="page-canvas" aria-label={`Preview of ${file.name}`} />
    </>
  );
}

export default function Preview({ files }) {
  const [sel, setSel] = useState(0);
  const idx = Math.min(sel, files.length - 1);
  const file = files[idx];

  return (
    <section className="preview" aria-label="Preview">
      {files.length > 1 && (
        <select
          className="pick"
          value={idx}
          onChange={(e) => setSel(Number(e.target.value))}
          aria-label="File to preview"
        >
          {files.map((f, i) => (
            <option key={f.name + i} value={i}>
              {f.name}
            </option>
          ))}
        </select>
      )}
      {file.type.startsWith('image/') ? <ImagePreview file={file} /> : <PdfPreview file={file} />}
    </section>
  );
}
