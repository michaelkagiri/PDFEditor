import { useState, useRef, useEffect } from 'react'

const SUGGESTED = [
  'Summarize this document',
  'What are the key points?',
  'What is the main argument?',
  'List all topics covered',
]

export default function ChatPanel({ pdfText, hasDocument, messages, setMessages, history, setHistory }) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const textareaRef = useRef(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const autoResize = () => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
  }

  const send = async (text) => {
    const q = (text || input).trim()
    if (!q || loading || !hasDocument) return

    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setLoading(true)

    const userMsg = { role: 'user', text: q }
    setMessages(prev => [...prev, userMsg])

    const newHistory = [...history, { role: 'user', content: q }]

    try {
      const system = `You are a precise document analyst. Answer questions based only on the document text below. Be concise and accurate. If the answer isn't in the document, say so.\n\nDocument:\n${pdfText.slice(0, 14000)}`

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system,
          messages: newHistory,
        }),
      })

      const data = await res.json()
      const reply = data.content?.map(b => b.text || '').join('') || 'No response.'

      setHistory([...newHistory, { role: 'assistant', content: reply }])
      setMessages(prev => [...prev, { role: 'assistant', text: reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Something went wrong. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="chat-panel">
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            {hasDocument ? (
              <>
                <div className="chat-empty-icon">?</div>
                <p>Document loaded. Ask me anything about it.</p>
                <div className="suggestions">
                  {SUGGESTED.map(q => (
                    <button key={q} className="suggestion-btn" onClick={() => send(q)}>{q}</button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="chat-empty-icon">◈</div>
                <p>Upload a PDF to start asking questions.</p>
              </>
            )}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`message message-${msg.role}`}>
            <div className="message-label">{msg.role === 'user' ? 'You' : 'AI'}</div>
            <div className="message-bubble">{msg.text}</div>
          </div>
        ))}

        {loading && (
          <div className="message message-assistant">
            <div className="message-label">AI</div>
            <div className="message-bubble thinking">
              <span /><span /><span />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="chat-input-row">
        <textarea
          ref={textareaRef}
          className="chat-input"
          value={input}
          onChange={e => { setInput(e.target.value); autoResize() }}
          onKeyDown={handleKey}
          placeholder={hasDocument ? 'Ask anything about this document…' : 'Upload a PDF first…'}
          disabled={!hasDocument || loading}
          rows={1}
        />
        <button
          className="send-btn"
          onClick={() => send()}
          disabled={!input.trim() || !hasDocument || loading}
          aria-label="Send"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="19" x2="12" y2="5"/>
            <polyline points="5 12 12 5 19 12"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
