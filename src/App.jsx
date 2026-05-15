import { useState, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import PDFViewer from './components/PDFViewer'
import ChatPanel from './components/ChatPanel'
import UploadZone from './components/UploadZone'
import './App.css'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

export default function App() {
  const [pdfDoc, setPdfDoc] = useState(null)
  const [pdfText, setPdfText] = useState('')
  const [fileName, setFileName] = useState('')
  const [fileSize, setFileSize] = useState(0)
  const [pageCount, setPageCount] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [messages, setMessages] = useState([])
  const [history, setHistory] = useState([])

  const handleFile = useCallback(async (file) => {
    if (file.type !== 'application/pdf') return
    setIsProcessing(true)
    setMessages([])
    setHistory([])
    setFileName(file.name)
    setFileSize(file.size)
    setPdfDoc(null)

    try {
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      setPageCount(pdf.numPages)
      setPdfDoc(pdf)

      let text = ''
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        text += content.items.map(item => item.str).join(' ') + '\n'
      }
      setPdfText(text.trim())
    } catch (err) {
      console.error('PDF load error:', err)
    } finally {
      setIsProcessing(false)
    }
  }, [])

  const handleReset = () => {
    setPdfDoc(null)
    setPdfText('')
    setFileName('')
    setFileSize(0)
    setPageCount(0)
    setMessages([])
    setHistory([])
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo">
          <span className="logo-glyph">◈</span>
          <span className="logo-text">DocMind</span>
        </div>
        <div className="header-meta">
          {pageCount > 0 && (
            <span className="page-badge">{pageCount} {pageCount === 1 ? 'page' : 'pages'}</span>
          )}
          {fileName && (
            <span className="file-chip">
              <span className="file-chip-name">{fileName}</span>
              <button className="file-chip-reset" onClick={handleReset} title="Load new PDF">✕</button>
            </span>
          )}
        </div>
      </header>

      <main className="app-main">
        <div className="left-panel">
          {!pdfDoc && !isProcessing ? (
            <UploadZone onFile={handleFile} />
          ) : (
            <PDFViewer pdf={pdfDoc} isProcessing={isProcessing} />
          )}
        </div>
        <div className="right-panel">
          <ChatPanel
            pdfText={pdfText}
            hasDocument={!!pdfDoc}
            messages={messages}
            setMessages={setMessages}
            history={history}
            setHistory={setHistory}
          />
        </div>
      </main>
    </div>
  )
}
