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
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedId])

  return (
    <div className="w-full h-full flex flex-col bg-[#0f0f1a]">
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

        {/* Leica DISTO S910 Bluetooth */}
        {disto.isSupported && (
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => {
                if (disto.status === 'connected') {
                  disto.disconnect()
                } else {
                  disto.connect(false) // filtered scan
                }
              }}
              className={`px-3 py-1 rounded-l text-xs font-bold flex items-center gap-1.5 transition-colors ${
                disto.status === 'connected'
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : disto.status === 'connecting'
                  ? 'bg-yellow-700 text-yellow-200 animate-pulse'
                  : disto.status === 'error'
                  ? 'bg-red-800 hover:bg-red-700 text-red-200'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
              title={
                disto.status === 'connected'
                  ? `${disto.deviceName} — Click to disconnect`
                  : disto.error || 'Connect Leica DISTO via Bluetooth'
              }
            >
              {/* Laser icon */}
              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor">
                <path d="M1 8h3l2-3h4l2 3h3M8 5V1M5.5 5L3 2M10.5 5L13 2" stroke="currentColor" fill="none" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="8" cy="10" r="2" />
              </svg>
              {disto.status === 'connected'
                ? `${disto.deviceName}${disto.lastMeasurement ? ` ${disto.lastMeasurement}mm` : ''}`
                : disto.status === 'connecting'
                ? 'Connecting...'
                : 'DISTO'}
            </button>
            {disto.status !== 'connected' && disto.status !== 'connecting' && (
              <button
                onClick={() => disto.connect(true)} // scan ALL devices
                className="px-1.5 py-1 rounded-r bg-gray-700 hover:bg-gray-600 text-gray-400 hover:text-gray-200 text-xs border-l border-gray-600"
                title="Scan all Bluetooth devices (if DISTO not found)"
              >
                &#x25BC;
              </button>
            )}
          </div>
        )}

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
          className="w-6 bg-[#12122a] hover:bg-[#1a1a3a] border-r border-gray-700 flex items-center justify-center shrink-0 text-gray-500 hover:text-gray-300 transition-colors"
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
          className="w-6 bg-[#12122a] hover:bg-[#1a1a3a] border-l border-gray-700 flex items-center justify-center shrink-0 text-gray-500 hover:text-gray-300 transition-colors"
          title={rightOpen ? 'Hide sidebar' : 'Show sidebar'}
        >
          {rightOpen ? '\u25B6' : '\u25C0'}
        </button>
      </div>
    </div>
  )
}

export default App
