import { useRef } from 'react';
import { canvasBytes } from './render.js';
import './sign.css';

// Drawing pad that reports the signature as PNG bytes (or null when cleared).
export default function SignPad({ onChange }) {
  const canvas = useRef(null);
  const last = useRef(null);
  const drawing = useRef(false);

  // Convert pointer position to canvas pixels, so the drawing lines up at any display size.
  const point = (e) => {
    const c = canvas.current;
    const r = c.getBoundingClientRect();
    return [(e.clientX - r.left) * (c.width / r.width), (e.clientY - r.top) * (c.height / r.height)];
  };

  function down(e) {
    drawing.current = true;
    canvas.current.setPointerCapture(e.pointerId);
    last.current = point(e);
  }

  function move(e) {
    if (!drawing.current) return;
    const ctx = canvas.current.getContext('2d');
    const [x, y] = point(e);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(...last.current);
    ctx.lineTo(x, y);
    ctx.stroke();
    last.current = [x, y];
  }

  async function up() {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(await canvasBytes(canvas.current, 'image/png'));
  }

  function clear() {
    const c = canvas.current;
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
    onChange(null);
  }

  return (
    <section className="sign-pad">
      <div className="sign-bar">
        <span>Sign in the box</span>
        <button className="small" onClick={clear}>
          Clear
        </button>
      </div>
      <canvas
        ref={canvas}
        width={600}
        height={200}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={up}
        aria-label="Signature pad"
      />
    </section>
  );
}
