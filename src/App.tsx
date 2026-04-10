import { useEffect, useState } from 'react'
import Scene from './components/viewport3d/Scene'
import FloorPlan2D from './components/viewport2d/FloorPlan2D'
import SketchToolbar, { SketchStatusBar } from './components/viewport2d/SketchToolbar'
import CatalogSidebar from './components/sidebar/CatalogSidebar'
import WallEditor from './components/sidebar/WallEditor'
import PropertiesPanel from './components/properties/PropertiesPanel'
import QuotationPanel from './components/quotation/QuotationPanel'
import { useRoomStore } from './store/useRoomStore'
import { usePlacementStore } from './store/usePlacementStore'
import { useUIStore } from './store/useUIStore'
import { useLeicaDisto } from './hooks/useLeicaDisto'

type RightTab = 'properties' | 'quotation'
type ViewMode = '2d' | '3d'

function App() {
  const setRoomRect = useRoomStore(s => s.setRoomRect)
  const itemCount = usePlacementStore(s => s.items.length)
  const selectedId = usePlacementStore(s => s.selectedId)
  const selectItem = usePlacementStore(s => s.selectItem)
  const removeItem = usePlacementStore(s => s.removeItem)
  const leftOpen = useUIStore(s => s.leftOpen)
  const rightOpen = useUIStore(s => s.rightOpen)
  const leftTab = useUIStore(s => s.leftTab)
  const toggleLeft = useUIStore(s => s.toggleLeft)
  const toggleRight = useUIStore(s => s.toggleRight)
  const setLeftTab = useUIStore(s => s.setLeftTab)
  const [rightTab, setRightTab] = useState<RightTab>('properties')
  const [viewMode, setViewMode] = useState<ViewMode>('2d')
  const [roomW, setRoomW] = useState(4000)

  // Leica DISTO S910 Bluetooth
  const disto = useLeicaDisto()
  const [roomD, setRoomD] = useState(3000)

  // Don't auto-create room — start with blank sketch like Fusion 360
  // User draws walls manually with Line or Rectangle tool

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedId) {
        removeItem(selectedId)
      }
      if (e.key === 'Escape') {
        selectItem(null)
        useUIStore.getState().setDragCatalogId(null)
      }
      // F11 = Focus Mode (toggle both sidebars)
      if (e.key === 'F11') {
        e.preventDefault()
        const ui = useUIStore.getState()
        if (ui.leftOpen || ui.rightOpen) {
          if (ui.leftOpen) ui.toggleLeft()
          if (ui.rightOpen) ui.toggleRight()
        } else {
          if (!ui.leftOpen) ui.toggleLeft()
          if (!ui.rightOpen) ui.toggleRight()
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedId])

  return (
    <div className="fixed inset-0 flex flex-col bg-[#0f0f1a] overflow-hidden">
      {/* Top Toolbar */}
      <div className="h-12 bg-[#1a1a2e] border-b border-gray-700 flex items-center px-4 gap-4 shrink-0">
        <div className="text-lg font-bold text-blue-400">Rough Design</div>
        <div className="text-xs text-gray-500">Stainless Kitchen Planner</div>
        <div className="border-l border-gray-600 h-6 mx-2" />

        <label className="text-xs text-gray-400 flex items-center gap-1">
          W:
          <input
            type="number" value={roomW} onChange={e => setRoomW(Number(e.target.value))}
            step={100} className="w-16 bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-xs"
          />
        </label>
        <label className="text-xs text-gray-400 flex items-center gap-1">
          D:
          <input
            type="number" value={roomD} onChange={e => setRoomD(Number(e.target.value))}
            step={100} className="w-16 bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-xs"
          />
        </label>
        <span className="text-xs text-gray-500">mm</span>
        <button
          onClick={() => {
            useRoomStore.getState().clearWalls()
            setRoomRect(roomW, roomD)
          }}
          className="bg-blue-700 hover:bg-blue-600 px-2 py-0.5 rounded text-xs"
        >
          Create Room
        </button>

        <div className="border-l border-gray-600 h-6 mx-1" />

        {/* Undo / Redo */}
        <button
          onClick={() => useRoomStore.getState().undo()}
          className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Undo (Ctrl+Z)"
        >
          <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 8l4-4M4 8l4 4M4 8h9a4 4 0 010 8H11" />
          </svg>
        </button>
        <button
          onClick={() => useRoomStore.getState().redo()}
          className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Redo (Ctrl+Y)"
        >
          <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 8l-4-4M16 8l-4 4M16 8H7a4 4 0 000 8h2" />
          </svg>
        </button>

        <div className="flex-1" />

        <span className="text-xs text-gray-400">{itemCount} items</span>

        {/* 2D / 3D Toggle */}
        <div className="flex bg-gray-800 rounded overflow-hidden border border-gray-600">
          <button
            onClick={() => setViewMode('2d')}
            className={`px-3 py-1 text-xs font-bold transition-colors ${
              viewMode === '2d'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            2D
          </button>
          <button
            onClick={() => setViewMode('3d')}
            className={`px-3 py-1 text-xs font-bold transition-colors ${
              viewMode === '3d'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            3D
          </button>
        </div>

        {/* Focus Mode — hide both sidebars */}
        <button
          onClick={() => {
            if (leftOpen || rightOpen) {
              // Close both
              if (leftOpen) toggleLeft()
              if (rightOpen) toggleRight()
            } else {
              // Open both
              if (!leftOpen) toggleLeft()
              if (!rightOpen) toggleRight()
            }
          }}
          className={`p-1.5 rounded transition-colors ${
            !leftOpen && !rightOpen
              ? 'bg-blue-600 text-white'
              : 'hover:bg-gray-700 text-gray-400 hover:text-white'
          }`}
          title={leftOpen || rightOpen ? 'Focus Mode — ซ่อน sidebar (F11)' : 'แสดง sidebar'}
        >
          <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
            {leftOpen || rightOpen ? (
              <>
                <rect x="2" y="3" width="16" height="14" rx="1.5" />
                <line x1="6" y1="3" x2="6" y2="17" />
                <line x1="14" y1="3" x2="14" y2="17" />
                <path d="M8 10h4" />
              </>
            ) : (
              <>
                <rect x="2" y="3" width="16" height="14" rx="1.5" />
                <path d="M4 8l2 2-2 2" />
                <path d="M16 8l-2 2 2 2" />
              </>
            )}
          </svg>
        </button>

        {/* Leica DISTO S910 — Keyboard BT mode indicator */}
        <button
          onClick={() => {
            // Switch to dimension tool for DISTO workflow
            useUIStore.getState().setSketchTool('dimension')
            setViewMode('2d')
          }}
          className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-1.5 transition-colors ${
            useUIStore.getState().sketchTool === 'dimension'
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
          }`}
          title="DISTO Measure Mode — Click walls to input laser measurements (D)"
        >
          {/* Laser icon */}
          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M1 8h3l2-3h4l2 3h3" />
            <path d="M8 5V1M5.5 5L3 2M10.5 5L13 2" />
            <circle cx="8" cy="10" r="2" fill="currentColor" />
          </svg>
          Laser
        </button>

        <button
          onClick={() => {
            const canvas = document.querySelector('canvas')
            if (canvas) {
              const link = document.createElement('a')
              link.download = 'kitchen-render.png'
              link.href = canvas.toDataURL('image/png')
              link.click()
            }
          }}
          className="bg-green-700 hover:bg-green-600 px-3 py-1 rounded text-xs"
        >
          Screenshot
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Left sidebar toggle */}
        <button
          onClick={toggleLeft}
          className="w-4 bg-[#12122a] hover:bg-[#1a1a3a] border-r border-gray-700 flex items-center justify-center shrink-0 text-gray-600 hover:text-gray-300 transition-colors text-[8px]"
          title={leftOpen ? 'Hide sidebar' : 'Show sidebar'}
        >
          {leftOpen ? '\u25C0' : '\u25B6'}
        </button>

        {/* Left sidebar — Catalog / Walls */}
        {leftOpen && (
          <div className="w-64 bg-[#12122a] border-r border-gray-700 flex flex-col shrink-0">
            {/* Tab switcher */}
            <div className="flex border-b border-gray-700">
              <button
                onClick={() => setLeftTab('catalog')}
                className={`flex-1 h-8 text-xs font-bold transition-colors ${
                  leftTab === 'catalog' ? 'bg-[#1a1a2e] text-blue-400' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                CATALOG
              </button>
              <button
                onClick={() => setLeftTab('walls')}
                className={`flex-1 h-8 text-xs font-bold transition-colors ${
                  leftTab === 'walls' ? 'bg-[#1a1a2e] text-blue-400' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                WALLS
              </button>
            </div>
            {leftTab === 'catalog' ? <CatalogSidebar /> : <WallEditor />}
          </div>
        )}

        {/* Viewport — 2D or 3D */}
        <div className="flex-1 flex flex-col min-w-0">
          {viewMode === '2d' && <SketchToolbar />}
          <div className="flex-1 relative min-h-0">
            {viewMode === '2d' ? <FloorPlan2D distoHook={disto} /> : <Scene />}
          </div>
          {viewMode === '2d' && <SketchStatusBar />}
        </div>

        {/* Right sidebar — Properties / Quotation */}
        {rightOpen && (
          <div className="w-64 bg-[#12122a] border-l border-gray-700 flex flex-col shrink-0">
            <div className="flex border-b border-gray-700">
              <button
                onClick={() => setRightTab('properties')}
                className={`flex-1 h-8 text-xs font-bold transition-colors ${
                  rightTab === 'properties' ? 'bg-[#1a1a2e] text-blue-400' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                PROPERTIES
              </button>
              <button
                onClick={() => setRightTab('quotation')}
                className={`flex-1 h-8 text-xs font-bold transition-colors ${
                  rightTab === 'quotation' ? 'bg-[#1a1a2e] text-blue-400' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                QUOTATION
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {rightTab === 'properties' ? <PropertiesPanel /> : <QuotationPanel />}
            </div>
          </div>
        )}

        {/* Right sidebar toggle */}
        <button
          onClick={toggleRight}
          className="w-4 bg-[#12122a] hover:bg-[#1a1a3a] border-l border-gray-700 flex items-center justify-center shrink-0 text-gray-600 hover:text-gray-300 transition-colors text-[8px]"
          title={rightOpen ? 'Hide sidebar' : 'Show sidebar'}
        >
          {rightOpen ? '\u25B6' : '\u25C0'}
        </button>
      </div>
    </div>
  )
}

export default App
