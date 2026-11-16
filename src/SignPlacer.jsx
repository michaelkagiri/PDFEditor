import { useEffect, useMemo, useRef, useState } from 'react';
import { openPdf } from './render.js';
import './placer.css';

const WIDTH = 640;
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));

// Shows the PDF page by page. The signature sits on one page and can be dragged anywhere on it.
// Reports { page, x, y, w } as fractions of the page: x and y are the top-left corner, w is the width.
export default function SignPlacer({ file, signature, onChange }) {
  const canvas = useRef(null);
  const wrap = useRef(null);
  const box = useRef(null);
  const task = useRef(null);
  const drag = useRef(null);
  const [doc, setDoc] = useState(null);
  const [view, setView] = useState(1);
  const [place, setPlace] = useState({ page: 1, x: 0.6, y: 0.85, w: 0.25 });
  const [err, setErr] = useState('');

  const sigUrl = useMemo(
    () => (signature ? URL.createObjectURL(new Blob([signature], { type: 'image/png' })) : ''),
    [signature]
  );
  useEffect(() => () => sigUrl && URL.revokeObjectURL(sigUrl), [sigUrl]);

  // Tell the tool panel where the signature is whenever it changes.
  useEffect(() => {
    onChange(place);
  }, [place]);

  // Open the file when it is selected, and close it when the selection changes.
  useEffect(() => {
    let alive = true;
    let opened = null;
    setDoc(null);
    setErr('');
    setView(1);
    setPlace((p) => ({ ...p, page: 1 }));
    openPdf(file.bytes)
      .then((d) => {
        if (!alive) return d.destroy();
        opened = d;
        setDoc(d);
      })
      .catch(() => {
        if (alive) setErr('This PDF could not be previewed.');
      });
    return () => {
      alive = false;
      opened?.destroy();
    };
  }, [file]);

  // Draw the page being viewed.
  useEffect(() => {
    if (!doc) return;
    (async () => {
      const pg = await doc.getPage(view);
      const base = pg.getViewport({ scale: 1 });
      const vp = pg.getViewport({ scale: WIDTH / base.width });
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
  }, [doc, view]);

  // Dragging: remember where the pointer started, then move by the same distance in page fractions.
  function down(e) {
    e.preventDefault();
    box.current.setPointerCapture(e.pointerId);
    const r = wrap.current.getBoundingClientRect();
    drag.current = { px: e.clientX, py: e.clientY, x: place.x, y: place.y, W: r.width, H: r.height };
  }

  function move(e) {
    const d = drag.current;
    if (!d) return;
    const boxH = box.current.offsetHeight / d.H;
    setPlace((p) => ({
      ...p,
      x: clamp(d.x + (e.clientX - d.px) / d.W, 0, 1 - p.w),
      y: clamp(d.y + (e.clientY - d.py) / d.H, 0, 1 - boxH),
    }));
  }

  function up() {
    drag.current = null;
  }

  if (err) return <p className="err">{err}</p>;
  const total = doc ? doc.numPages : 0;
  const onThis = place.page === view;

  return (
    <section className="sign-place" aria-label="Place signature">
      <div className="pager">
        <button className="small" disabled={!doc || view <= 1} onClick={() => setView((v) => v - 1)}>
          Previous
        </button>
        <span>{doc ? `Page ${view} of ${total}` : 'Loading preview…'}</span>
        <button className="small" disabled={!doc || view >= total} onClick={() => setView((v) => v + 1)}>
          Next
        </button>
      </div>

      <div className="place-wrap" ref={wrap}>
        <canvas ref={canvas} aria-label={`Preview of ${file.name}`} />
        {signature && onThis && (
          <div
            ref={box}
            className="sig-box"
            style={{ left: `${place.x * 100}%`, top: `${place.y * 100}%`, width: `${place.w * 100}%` }}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
          >
            <img src={sigUrl} alt="Your signature" draggable={false} />
          </div>
        )}
      </div>

      <div className="place-hint">
        {!signature && <span>Draw your signature above, then drag it onto the page.</span>}
        {signature && onThis && <span>Drag the signature where you want it.</span>}
        {signature && !onThis && (
          <>
            <span>Your signature is on page {place.page}.</span>
            <button className="small" onClick={() => setPlace((p) => ({ ...p, page: view }))}>
              Move it to this page
            </button>
          </>
        )}
      </div>
    </section>
  );
}
