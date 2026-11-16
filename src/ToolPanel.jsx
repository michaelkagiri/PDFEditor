import { useRef, useState } from 'react';
import { formatSize } from './pdf.js';
import Preview from './Preview.jsx';

function initialOptions(tool) {
  return Object.fromEntries(
    (tool.opts || []).map((o) => [o.key, o.type === 'select' ? o.options[0][0] : o.value || ''])
  );
}

export default function ToolPanel({ tool }) {
  const [files, setFiles] = useState([]);
  const [opts, setOpts] = useState(() => initialOptions(tool));
  const [outs, setOuts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const picker = useRef(null);
  const min = tool.min || 1;

  function clearOuts() {
    outs.forEach((o) => URL.revokeObjectURL(o.url));
    setOuts([]);
  }

  async function addFiles(list) {
    if (!list.length) return;
    const ok = list.filter((f) => tool.accept.split(',').includes(f.type));
    setErr(ok.length < list.length ? `Skipped files that are not ${tool.types}.` : '');
    if (!ok.length) return;

    const read = await Promise.all(
      ok.map(async (f) => ({
        name: f.name,
        size: f.size,
        type: f.type,
        bytes: new Uint8Array(await f.arrayBuffer()),
      }))
    );
    clearOuts();
    setFiles((prev) => (tool.multi ? [...prev, ...read] : read.slice(0, 1)));
  }

  function move(i, d) {
    setFiles((prev) => {
      const next = [...prev];
      const j = i + d;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  const remove = (i) => setFiles((prev) => prev.filter((_, k) => k !== i));

  async function run() {
    clearOuts();
    setBusy(true);
    setErr('');
    try {
      const results = await tool.run(files, opts);
      setOuts(
        results.map((r) => ({
          ...r,
          url: URL.createObjectURL(new Blob([r.bytes], { type: r.type || 'application/pdf' })),
        }))
      );
    } catch (e) {
      const msg = String(e.message);
      setErr(
        msg.includes('encrypted')
          ? 'This file is password protected, so it cannot be changed here.'
          : `Could not process the file. ${msg}`
      );
    }
    setBusy(false);
  }

  return (
    <>
      <h1>{tool.name}</h1>
      <p className="lede">{tool.lede}</p>

      <button
        className="drop"
        onClick={() => picker.current.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          addFiles([...e.dataTransfer.files]);
        }}
      >
        {files.length && tool.multi
          ? 'Add more or drop them here'
          : `Drop ${tool.types} files here, or choose files`}
      </button>
      <input
        ref={picker}
        type="file"
        hidden
        multiple={!!tool.multi}
        accept={tool.accept}
        onChange={(e) => {
          addFiles([...e.target.files]);
          e.target.value = '';
        }}
      />

      {files.length > 0 && (
        <ol className="files">
          {files.map((f, i) => (
            <li key={f.name + i}>
              <span className="num">{i + 1}</span>
              <span className="name">
                {f.name}
                <span className="size">{formatSize(f.size)}</span>
              </span>
              <span className="acts">
                {tool.multi && (
                  <>
                    <button className="small" aria-label={`Move ${f.name} up`} onClick={() => move(i, -1)}>
                      Up
                    </button>
                    <button className="small" aria-label={`Move ${f.name} down`} onClick={() => move(i, 1)}>
                      Down
                    </button>
                  </>
                )}
                <button className="small" aria-label={`Remove ${f.name}`} onClick={() => remove(i)}>
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}

      {files.length > 0 && !tool.Place && <Preview files={files} />}

      {files.length > 0 && tool.Pad && <tool.Pad onChange={(sig) => setOpts((prev) => ({ ...prev, sig }))} />}

      {files.length > 0 && tool.Place && (
        <tool.Place file={files[0]} signature={opts.sig} onChange={(place) => setOpts((prev) => ({ ...prev, place }))} />
      )}

      {(tool.opts || []).length > 0 && (
        <div className="opts">
          {tool.opts.map((o) => (
            <label className="field" key={o.key}>
              {o.label}
              {o.type === 'select' ? (
                <select value={opts[o.key]} onChange={(e) => setOpts({ ...opts, [o.key]: e.target.value })}>
                  {o.options.map(([v, t]) => (
                    <option key={v} value={v}>
                      {t}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder={o.placeholder}
                  value={opts[o.key]}
                  onChange={(e) => setOpts({ ...opts, [o.key]: e.target.value })}
                />
              )}
            </label>
          ))}
        </div>
      )}

      <button className="go" disabled={busy || files.length < min} onClick={run}>
        {busy ? 'Working…' : tool.action}
      </button>
      {err && <p className="err" role="alert">{err}</p>}

      {outs.length > 0 && (
        <div className="out">
          {outs.map((r, i) => (
            <a key={i} href={r.url} download={r.name}>
              <span>{r.name}</span>
              <span>{formatSize(r.bytes.length)}</span>
            </a>
          ))}
        </div>
      )}
    </>
  );
}
