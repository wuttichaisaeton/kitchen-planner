import { useState, useEffect, useRef } from 'react'
import { useUIStore, type OpeningPreset } from '../../store/useUIStore'

// Door presets
const DOOR_PRESETS = [
  { label: 'ประตูบานเดี่ยว 70', width: 700, height: 2000 },
  { label: 'ประตูบานเดี่ยว 80', width: 800, height: 2000 },
  { label: 'ประตูบานเดี่ยว 90', width: 900, height: 2100 },
  { label: 'ประตูบานคู่ 160', width: 1600, height: 2100 },
  { label: 'ประตูบานคู่ 180', width: 1800, height: 2100 },
]

const WINDOW_PRESETS = [
  { label: 'หน้าต่าง 60×110', width: 600, height: 1100, sill: 900 },
  { label: 'หน้าต่าง 80×110', width: 800, height: 1100, sill: 900 },
  { label: 'หน้าต่าง 100×110', width: 1000, height: 1100, sill: 900 },
  { label: 'หน้าต่าง 120×110', width: 1200, height: 1100, sill: 900 },
  { label: 'หน้าต่าง 150×110', width: 1500, height: 1100, sill: 900 },
  { label: 'หน้าต่าง 180×110', width: 1800, height: 1100, sill: 900 },
  { label: 'ช่องแสง 40×40', width: 400, height: 400, sill: 1800 },
]

export default function OpeningDialog() {
  const showOpeningDialog = useUIStore(s => s.showOpeningDialog)
  const openingPreset = useUIStore(s => s.openingPreset)
  const confirmOpeningPreset = useUIStore(s => s.confirmOpeningPreset)
  const setShowOpeningDialog = useUIStore(s => s.setShowOpeningDialog)
  const setSketchTool = useUIStore(s => s.setSketchTool)

  const [width, setWidth] = useState(900)
  const [height, setHeight] = useState(2100)
  const [sillHeight, setSillHeight] = useState(0)
  const [hingePosition, setHingePosition] = useState<'start' | 'end'>('start')
  const [swingSide, setSwingSide] = useState<'inside' | 'outside'>('inside')

  const dialogRef = useRef<HTMLDivElement>(null)

  // Sync from preset when dialog opens
  useEffect(() => {
    if (showOpeningDialog && openingPreset) {
      setWidth(openingPreset.width)
      setHeight(openingPreset.height)
      setSillHeight(openingPreset.sillHeight)
      setHingePosition(openingPreset.hingePosition)
      setSwingSide(openingPreset.swingSide)
    }
  }, [showOpeningDialog, openingPreset])

  if (!showOpeningDialog || !openingPreset) return null

  const isDoor = openingPreset.type === 'door'
  const presets = isDoor ? DOOR_PRESETS : WINDOW_PRESETS

  const handleConfirm = () => {
    confirmOpeningPreset({
      type: openingPreset.type,
      width,
      height,
      sillHeight,
      hingePosition,
      swingSide,
    })
  }

  const handleCancel = () => {
    setShowOpeningDialog(false)
    // Don't revert tool — keep it but close dialog, so user can just click again
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleConfirm()
    if (e.key === 'Escape') handleCancel()
  }

  return (
    <div
      className="fixed inset-0 z-[900] flex items-center justify-center bg-black/30"
      onClick={(e) => { if (e.target === e.currentTarget) handleCancel() }}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={dialogRef}
        className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-[340px] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-3">
          <span className="text-2xl">{isDoor ? '🚪' : '🪟'}</span>
          <div>
            <div className="text-sm font-bold text-gray-800">
              {isDoor ? 'ประตู (Door)' : 'หน้าต่าง (Window)'}
            </div>
            <div className="text-[10px] text-gray-500">กำหนดขนาดและรูปแบบ แล้วคลิกวางบนผนัง</div>
          </div>
        </div>

        {/* Quick presets */}
        <div className="px-5 pt-3 pb-1">
          <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1.5 font-medium">ขนาดมาตรฐาน</div>
          <div className="flex flex-wrap gap-1.5">
            {presets.map(p => (
              <button
                key={p.label}
                onClick={() => {
                  setWidth(p.width)
                  setHeight(p.height)
                  if ('sill' in p) setSillHeight(p.sill as number)
                }}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-all ${
                  width === p.width && height === p.height
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-blue-50 hover:border-blue-300'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom size inputs */}
        <div className="px-5 py-3 space-y-2.5">
          <div className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">กำหนดเอง</div>
          <div className="grid grid-cols-2 gap-2.5">
            <label className="text-xs text-gray-600">
              <span className="block mb-0.5 font-medium">กว้าง (mm)</span>
              <input
                type="number" step={50} min={100}
                value={width}
                onChange={e => setWidth(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none"
              />
            </label>
            <label className="text-xs text-gray-600">
              <span className="block mb-0.5 font-medium">สูง (mm)</span>
              <input
                type="number" step={50} min={100}
                value={height}
                onChange={e => setHeight(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none"
              />
            </label>
          </div>

          {/* Window sill height */}
          {!isDoor && (
            <label className="text-xs text-gray-600 block">
              <span className="block mb-0.5 font-medium">ความสูงขอบล่าง (mm)</span>
              <input
                type="number" step={50} min={0}
                value={sillHeight}
                onChange={e => setSillHeight(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none"
              />
            </label>
          )}

          {/* Door options */}
          {isDoor && (
            <div className="space-y-2">
              <div className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">รูปแบบการเปิด</div>
              <div className="flex gap-2">
                <button
                  onClick={() => setHingePosition(h => h === 'start' ? 'end' : 'start')}
                  className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-all ${
                    hingePosition === 'start'
                      ? 'bg-amber-50 border-amber-400 text-amber-700'
                      : 'bg-orange-50 border-orange-400 text-orange-700'
                  }`}
                >
                  <div className="text-lg mb-0.5">{hingePosition === 'start' ? '◁━' : '━▷'}</div>
                  บานพับ{hingePosition === 'start' ? 'ซ้าย' : 'ขวา'}
                </button>
                <button
                  onClick={() => setSwingSide(s => s === 'inside' ? 'outside' : 'inside')}
                  className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-all ${
                    swingSide === 'inside'
                      ? 'bg-blue-50 border-blue-400 text-blue-700'
                      : 'bg-green-50 border-green-400 text-green-700'
                  }`}
                >
                  <div className="text-lg mb-0.5">{swingSide === 'inside' ? '↙' : '↗'}</div>
                  เปิด{swingSide === 'inside' ? 'เข้า' : 'ออก'}
                </button>
              </div>

              {/* Door preview */}
              <div className="flex justify-center pt-1">
                <svg width="120" height="80" viewBox="0 0 120 80" className="border border-gray-200 rounded-lg bg-gray-50">
                  {/* Wall */}
                  <rect x="10" y="30" width="100" height="8" fill="#333" />
                  {/* Opening gap */}
                  <rect x="35" y="30" width="50" height="8" fill="white" />
                  {/* Hinge point */}
                  <circle
                    cx={hingePosition === 'start' ? 35 : 85}
                    cy="34"
                    r="3" fill="#8B4513"
                  />
                  {/* Door leaf */}
                  <line
                    x1={hingePosition === 'start' ? 35 : 85}
                    y1="34"
                    x2={hingePosition === 'start' ? 35 : 85}
                    y2={swingSide === 'inside' ? 34 - 45 : 34 + 45}
                    stroke="#333" strokeWidth="1.5"
                  />
                  {/* Arc */}
                  <path
                    d={
                      hingePosition === 'start'
                        ? swingSide === 'inside'
                          ? 'M 35 -11 A 45 45 0 0 1 85 34'
                          : 'M 35 79 A 45 45 0 0 0 85 34'
                        : swingSide === 'inside'
                          ? 'M 85 -11 A 45 45 0 0 0 35 34'
                          : 'M 85 79 A 45 45 0 0 1 35 34'
                    }
                    fill="none" stroke="#999" strokeWidth="0.8" strokeDasharray="3 3"
                  />
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex gap-2">
          <button
            onClick={handleCancel}
            className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-100 transition-colors"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-2 rounded-lg bg-blue-500 text-white text-sm font-bold hover:bg-blue-600 transition-colors"
          >
            ✓ วางบนผนัง
          </button>
        </div>
      </div>
    </div>
  )
}
