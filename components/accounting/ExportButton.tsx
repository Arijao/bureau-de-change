'use client'

export default function ExportButton() {
  const handleExport = () => {
    window.print()
  }

  return (
    <button className="btn btn-outline" onClick={handleExport}>
      📥 Exporter
    </button>
  )
}