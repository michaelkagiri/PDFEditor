import { useState } from 'react';
import { TOOLS } from './tools.js';
import ToolPanel from './ToolPanel.jsx';

export default function App() {
  const [id, setId] = useState(TOOLS[0].id);
  const tool = TOOLS.find((t) => t.id === id);

  return (
    <div className="shell">
      <nav>
        <p className="brand">Plain PDF</p>
        <ul>
          {TOOLS.map((t) => (
            <li key={t.id}>
              <button aria-current={t.id === id ? 'page' : undefined} onClick={() => setId(t.id)}>
                {t.name}
              </button>
            </li>
          ))}
        </ul>
        <p className="note">Files stay in your browser. Nothing is uploaded.</p>
      </nav>

      <main>
        <ToolPanel key={tool.id} tool={tool} />
      </main>
    </div>
  );
}
