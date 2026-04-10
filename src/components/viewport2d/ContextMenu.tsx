import { useState, useEffect, useRef } from 'react'
import { useUIStore, type SketchTool } from '../../store/useUIStore'

// All tools with labels and icons (compact inline SVGs)
const ALL_TOOLS: { id: SketchTool; label: string; shortcut: string; group: string }[] = [
  { id: 'select', label: 'Select', shortcut: 'ESC', group: 'MODIFY' },
  { id: 'line', label: 'Line', shortcut: 'L', group: 'CREATE' },
  { id: 'rectangle', label: 'Rectangle', shortcut: 'R', group: 'CREATE' },
  { id: 'construction', label: 'Guide', shortcut: 'X', group: 'CREATE' },
  { id: 'door', label: 'Door', shortcut: 'O', group: 'CREATE' },
  { id: 'window', label: 'Window', shortcut: 'N', group: 'CREATE' },
  { id: 'column', label: 'Column', shortcut: 'P', group: 'CREATE' },
  { id: 'dimension', label: 'Dimension', shortcut: 'D', group: 'INSPECT' },
  { id: 'trim', label: 'Trim/Delete', shortcut: 'T', group: 'MODIFY' },
  { id: 'offset', label: 'Offset', shortcut: 'F', group: 'MODIFY' },
  { id: 'fillet', label: 'Fillet', shortcut: 'G', group: 'MODIFY' },
  { id: 'mirror', label: 'Mirror', shortcut: 'M', group: 'MODIFY' },
  { id: 'hv', label: 'H/V Constraint', shortcut: 'H', group: 'CONSTRAINTS' },
  { id: 'perpendicular', label: 'Perpendicular', shortcut: 'Q', group: 'CONSTRAINTS' },
  { id: 'equal', label: 'Equal', shortcut: 'E', group: 'CONSTRAINTS' },
  { id: 'parallel', label: 'Parallel', shortcut: '/', group: 'CONSTRAINTS' },
  { id: 'coincident', label: 'Coincident', shortcut: 'J', group: 'CONSTRAINTS' },
  { id: 'fix', label: 'Fix', shortcut: 'K', group: 'CONSTRAINTS' },
  { id: 'symmetric', label: 'Symmetric', shortcut: 'S', group: 'CONSTRAINTS' },
]

interface ContextMenuProps {
  x: number
  y: number
  onClose: () => void
  onZoomIn?: () => void
  onZoomOut?: () => void
  onZoomFit?: () => void
}

export default function ContextMenu({ x, y, onClose, onZoomIn, onZoomOut, onZoomFit }: ContextMenuProps) {
  const [customizing, setCustomizing] = useState(false)
  const favoriteTools = useUIStore(s => s.favoriteTools)
  const toggleFavoriteTool = useUIStore(s => s.toggleFavoriteTool)
  const setSketchTool = useUIStore(s => s.setSketchTool)
  const sketchTool = useUIStore(s => s.sketchTool)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', escHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', escHandler)
    }
  }, [onClose])

  // Clamp menu position to viewport
  const menuW = customizing ? 240 : 180
  const menuH = customizing ? 420 : Math.min(favoriteTools.length * 36 + 50, 400)
  const clampedX = Math.min(x, window.innerWidth - menuW - 8)
  const clampedY = Math.min(y, window.innerHeight - menuH - 8)

  if (customizing) {
    // Group tools for the customize view
    const groups = ['CREATE', 'MODIFY', 'CONSTRAINTS', 'INSPECT'] as const
    return (
      <div
        ref={menuRef}
        className="fixed z-[999] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
        style={{ left: clampedX, top: clampedY, width: menuW }}
        onContextMenu={e => e.preventDefault()}
      >
        <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <span className="text-xs font-bold text-gray-700">Customize Quick Menu</span>
          <button
            onClick={() => setCustomizing(false)}
            className="text-blue-600 text-xs font-medium hover:text-blue-800"
          >
            Done
          </button>
        </div>
        <div className="max-h-[360px] overflow-y-auto py-1">
          {groups.map(group => {
            const groupTools = ALL_TOOLS.filter(t => t.group === group)
            return (
              <div key={group}>
                <div className="px-3 pt-2 pb-1 text-[9px] font-bold text-gray-400 uppercase tracking-wider">{group}</div>
                {groupTools.map(tool => {
                  const isFav = favoriteTools.includes(tool.id)
                  return (
                    <button
                      key={tool.id}
                      onClick={() => toggleFavoriteTool(tool.id)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 transition-colors"
                    >
                      <span className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                        isFav ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 text-transparent'
                      }`}>
                        {isFav ? '✓' : ''}
                      </span>
                      <span className="text-xs text-gray-700 flex-1 text-left">{tool.label}</span>
                      <span className="text-[10px] text-gray-400">{tool.shortcut}</span>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Main context menu — show favorites
  const favTools = ALL_TOOLS.filter(t => favoriteTools.includes(t.id))

  return (
    <div
      ref={menuRef}
      className="fixed z-[999] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
      style={{ left: clampedX, top: clampedY, width: menuW }}
      onContextMenu={e => e.preventDefault()}
    >
      <div className="py-1">
        {favTools.map(tool => (
          <button
            key={tool.id}
            onClick={() => { setSketchTool(tool.id); onClose() }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 transition-colors ${
              sketchTool === tool.id
                ? 'bg-blue-50 text-blue-700'
                : 'hover:bg-gray-100 text-gray-700'
            }`}
          >
            <span className="text-sm flex-1 text-left">{tool.label}</span>
            <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-mono">{tool.shortcut}</span>
          </button>
        ))}
      </div>
      {/* Zoom section */}
      <div className="border-t border-gray-200 py-1">
        <div className="px-3 py-1 text-[9px] text-gray-400 uppercase tracking-wider font-medium">View</div>
        <button
          onClick={() => { onZoomFit?.(); onClose() }}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-100 text-gray-700 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
          <span className="text-sm flex-1 text-left">Zoom Fit</span>
        </button>
        <button
          onClick={() => { onZoomIn?.(); onClose() }}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-100 text-gray-700 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
          </svg>
          <span className="text-sm flex-1 text-left">Zoom In</span>
          <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-mono">+</span>
        </button>
        <button
          onClick={() => { onZoomOut?.(); onClose() }}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-100 text-gray-700 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="8" y1="11" x2="14" y2="11" />
          </svg>
          <span className="text-sm flex-1 text-left">Zoom Out</span>
          <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-mono">−</span>
        </button>
      </div>
      <div className="border-t border-gray-200">
        <button
          onClick={() => setCustomizing(true)}
          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span className="text-xs">Customize...</span>
        </button>
      </div>
    </div>
  )
}
