import { useEffect, useRef, useState } from 'react'

export default function PDFViewer({ pdf, isProcessing }) {
  const containerRef = useRef(null)
  const [rendered, setRendered] = useState(false)

  useEffect(() => {
    if (!pdf || !containerRef.current) return

    const container = containerRef.current
    container.innerHTML = ''
    setRendered(false)

    const render = async () => {
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const viewport = page.getViewport({ scale: 1.6 })
        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        canvas.className = 'pdf-canvas'
        const ctx = canvas.getContext('2d')
        await page.render({ canvasContext: ctx, viewport }).promise

        const wrapper = document.createElement('div')
        wrapper.className = 'page-wrapper'
        const num = document.createElement('div')
        num.className = 'page-num'
        num.textContent = `${i} / ${pdf.numPages}`
        wrapper.appendChild(canvas)
        wrapper.appendChild(num)
        container.appendChild(wrapper)
      }
      setRendered(true)
    }

    render()
  }, [pdf])

  if (isProcessing) {
    return (
      <div className="pdf-loading">
        <div className="spinner" />
        <span>Processing document…</span>
      </div>
    )
  }

  return <div className="pdf-scroll" ref={containerRef} />
}
