import { useState } from 'react'
import { useRoomStore } from '../../store/useRoomStore'
import { Wall, Opening } from '../../types/kitchen'

function wallLength(w: Wall) {
  const dx = w.end.x - w.start.x
  const dy = w.end.y - w.start.y
  return Math.round(Math.sqrt(dx * dx + dy * dy))
}

function OpeningRow({ wallId, opening }: { wallId: string; opening: Opening }) {
  const updateOpening = useRoomStore(s => s.updateOpening)
  const removeOpening = useRoomStore(s => s.removeOpening)

  const hinge = opening.hingePosition || 'start'
  const swing = opening.swingSide || 'inside'

  return (
    <div className="bg-gray-800/60 rounded p-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">
          {opening.type === 'door' ? '🚪 Door' : '🪟 Window'}
        </span>
        <button
          onClick={() => removeOpening(wallId, opening.id)}
          className="text-red-400 hover:text-red-300 text-xs px-1"
        >
          ✕
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <label className="text-xs">
          <span className="text-gray-500">Offset</span>
          <input
            type="number" step={50}
            value={Math.round(opening.offsetFromStart)}
            onChange={e => updateOpening(wallId, opening.id, { offsetFromStart: Number(e.target.value) })}
            className="w-full bg-gray-900 border border-gray-600 rounded px-1.5 py-0.5 text-xs"
          />
        </label>
        <label className="text-xs">
          <span className="text-gray-500">Width</span>
          <input
            type="number" step={50}
            value={opening.width}
            onChange={e => updateOpening(wallId, opening.id, { width: Number(e.target.value) })}
            className="w-full bg-gray-900 border border-gray-600 rounded px-1.5 py-0.5 text-xs"
          />
        </label>
        <label className="text-xs">
          <span className="text-gray-500">Height</span>
          <input
            type="number" step={50}
            value={opening.height}
            onChange={e => updateOpening(wallId, opening.id, { height: Number(e.target.value) })}
            className="w-full bg-gray-900 border border-gray-600 rounded px-1.5 py-0.5 text-xs"
          />
        </label>
        <label className="text-xs">
          <span className="text-gray-500">Sill H</span>
          <input
            type="number" step={50}
            value={opening.sillHeight}
            onChange={e => updateOpening(wallId, opening.id, { sillHeight: Number(e.target.value) })}
            className="w-full bg-gray-900 border border-gray-600 rounded px-1.5 py-0.5 text-xs"
          />
        </label>
      </div>

      {/* Door swing controls */}
      {opening.type === 'door' && (
        <div className="space-y-1">
          <div className="flex gap-1">
            <button
              onClick={() => updateOpening(wallId, opening.id, { hingePosition: hinge === 'start' ? 'end' : 'start' })}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-[10px] py-1 rounded border border-gray-600"
              title="Toggle hinge side"
            >
              Hinge: {hinge === 'start' ? '← Left' : 'Right →'}
            </button>
            <button
              onClick={() => updateOpening(wallId, opening.id, { swingSide: swing === 'inside' ? 'outside' : 'inside' })}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-[10px] py-1 rounded border border-gray-600"
              title="Toggle swing direction"
            >
              Swing: {swing === 'inside' ? 'Inside ↓' : 'Outside ↑'}
            </button>
          </div>
        </div>
      )}

      <div className="text-[10px] text-gray-500 text-right">mm</div>
    </div>
  )
}

function WallCard({ wall }: { wall: Wall }) {
  const [expanded, setExpanded] = useState(false)
  const selectedWallId = useRoomStore(s => s.selectedWallId)
  const selectWall = useRoomStore(s => s.selectWall)
  const updateWall = useRoomStore(s => s.updateWall)
  const removeWall = useRoomStore(s => s.removeWall)
  const addOpening = useRoomStore(s => s.addOpening)
  const isSelected = selectedWallId === wall.id
  const len = wallLength(wall)

  return (
    <div
      className={`rounded border transition-all ${
        isSelected ? 'border-blue-500 bg-blue-900/30' : 'border-gray-700 bg-gray-800/40 hover:border-gray-500'
      }`}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 p-2 cursor-pointer"
        onClick={() => { selectWall(isSelected ? null : wall.id); setExpanded(!expanded) }}
      >
        <span className="text-xs text-gray-500">{expanded ? '▼' : '▶'}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{wall.label || 'Wall'}</div>
          <div className="text-xs text-gray-400">{len} mm</div>
        </div>
        {wall.openings.length > 0 && (
          <span className="text-[10px] bg-gray-700 px-1.5 rounded text-gray-300">
            {wall.openings.length}
          </span>
        )}
      </div>

      {/* Expanded edit */}
      {expanded && (
        <div className="px-2 pb-2 space-y-2 border-t border-gray-700/50 pt-2">
          {/* Wall endpoints */}
          <div className="grid grid-cols-2 gap-1.5">
            <label className="text-xs">
              <span className="text-gray-500">Start X</span>
              <input
                type="number" step={50}
                value={wall.start.x}
                onChange={e => updateWall(wall.id, { start: { ...wall.start, x: Number(e.target.value) } })}
                className="w-full bg-gray-900 border border-gray-600 rounded px-1.5 py-0.5 text-xs"
              />
            </label>
            <label className="text-xs">
              <span className="text-gray-500">Start Y</span>
              <input
                type="number" step={50}
                value={wall.start.y}
                onChange={e => updateWall(wall.id, { start: { ...wall.start, y: Number(e.target.value) } })}
                className="w-full bg-gray-900 border border-gray-600 rounded px-1.5 py-0.5 text-xs"
              />
            </label>
            <label className="text-xs">
              <span className="text-gray-500">End X</span>
              <input
                type="number" step={50}
                value={wall.end.x}
                onChange={e => updateWall(wall.id, { end: { ...wall.end, x: Number(e.target.value) } })}
                className="w-full bg-gray-900 border border-gray-600 rounded px-1.5 py-0.5 text-xs"
              />
            </label>
            <label className="text-xs">
              <span className="text-gray-500">End Y</span>
              <input
                type="number" step={50}
                value={wall.end.y}
                onChange={e => updateWall(wall.id, { end: { ...wall.end, y: Number(e.target.value) } })}
                className="w-full bg-gray-900 border border-gray-600 rounded px-1.5 py-0.5 text-xs"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <label className="text-xs">
              <span className="text-gray-500">Height</span>
              <input
                type="number" step={100}
                value={wall.height}
                onChange={e => updateWall(wall.id, { height: Number(e.target.value) })}
                className="w-full bg-gray-900 border border-gray-600 rounded px-1.5 py-0.5 text-xs"
              />
            </label>
            <label className="text-xs">
              <span className="text-gray-500">Thickness</span>
              <input
                type="number" step={10}
                value={wall.thickness}
                onChange={e => updateWall(wall.id, { thickness: Number(e.target.value) })}
                className="w-full bg-gray-900 border border-gray-600 rounded px-1.5 py-0.5 text-xs"
              />
            </label>
          </div>

          {/* Openings */}
          <div className="space-y-1.5">
            <div className="text-xs text-gray-500 uppercase">Openings</div>
            {wall.openings.map(o => (
              <OpeningRow key={o.id} wallId={wall.id} opening={o} />
            ))}
          </div>

          {/* Add opening buttons */}
          <div className="flex gap-1.5">
            <button
              onClick={() => addOpening(wall.id, 'door')}
              className="flex-1 bg-amber-800 hover:bg-amber-700 text-xs py-1 rounded"
            >
              + Door
            </button>
            <button
              onClick={() => addOpening(wall.id, 'window')}
              className="flex-1 bg-sky-800 hover:bg-sky-700 text-xs py-1 rounded"
            >
              + Window
            </button>
          </div>

          {/* Delete wall */}
          <button
            onClick={() => removeWall(wall.id)}
            className="w-full bg-red-900/60 hover:bg-red-800 text-xs py-1 rounded text-red-300"
          >
            Delete Wall
          </button>
        </div>
      )}
    </div>
  )
}

function ColumnCard({ column }: { column: import('../../types/kitchen').Column }) {
  const updateColumn = useRoomStore(s => s.updateColumn)
  const removeColumn = useRoomStore(s => s.removeColumn)
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded border border-gray-700 bg-gray-800/40 hover:border-gray-500">
      <div className="flex items-center gap-2 p-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <span className="text-xs text-gray-500">{expanded ? '▼' : '▶'}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{column.label || 'Column'}</div>
          <div className="text-xs text-gray-400">{column.width} x {column.depth} mm</div>
        </div>
      </div>
      {expanded && (
        <div className="px-2 pb-2 space-y-2 border-t border-gray-700/50 pt-2">
          <div className="grid grid-cols-2 gap-1.5">
            <label className="text-xs">
              <span className="text-gray-500">Pos X</span>
              <input type="number" step={50} value={column.position.x}
                onChange={e => updateColumn(column.id, { position: { ...column.position, x: Number(e.target.value) } })}
                className="w-full bg-gray-900 border border-gray-600 rounded px-1.5 py-0.5 text-xs" />
            </label>
            <label className="text-xs">
              <span className="text-gray-500">Pos Y</span>
              <input type="number" step={50} value={column.position.y}
                onChange={e => updateColumn(column.id, { position: { ...column.position, y: Number(e.target.value) } })}
                className="w-full bg-gray-900 border border-gray-600 rounded px-1.5 py-0.5 text-xs" />
            </label>
            <label className="text-xs">
              <span className="text-gray-500">Width</span>
              <input type="number" step={50} value={column.width}
                onChange={e => updateColumn(column.id, { width: Number(e.target.value) })}
                className="w-full bg-gray-900 border border-gray-600 rounded px-1.5 py-0.5 text-xs" />
            </label>
            <label className="text-xs">
              <span className="text-gray-500">Depth</span>
              <input type="number" step={50} value={column.depth}
                onChange={e => updateColumn(column.id, { depth: Number(e.target.value) })}
                className="w-full bg-gray-900 border border-gray-600 rounded px-1.5 py-0.5 text-xs" />
            </label>
          </div>
          <button onClick={() => removeColumn(column.id)}
            className="w-full bg-red-900/60 hover:bg-red-800 text-xs py-1 rounded text-red-300">
            Delete Column
          </button>
        </div>
      )}
    </div>
  )
}

export default function WallEditor() {
  const walls = useRoomStore(s => s.walls)
  const columns = useRoomStore(s => s.columns)
  const addWall = useRoomStore(s => s.addWall)
  const addColumn = useRoomStore(s => s.addColumn)

  const handleAddWall = () => {
    let maxX = 0, maxY = 0
    walls.forEach(w => {
      maxX = Math.max(maxX, w.start.x, w.end.x)
      maxY = Math.max(maxY, w.start.y, w.end.y)
    })
    addWall({ x: maxX, y: 0 }, { x: maxX + 2000, y: 0 })
  }

  const handleAddColumn = () => {
    let cx = 2000, cy = 1500
    walls.forEach(w => {
      cx = Math.max(cx, (w.start.x + w.end.x) / 2)
      cy = Math.max(cy, (w.start.y + w.end.y) / 2)
    })
    addColumn({ x: Math.round(cx / 2), y: Math.round(cy / 2) })
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {walls.length === 0 && columns.length === 0 && (
          <div className="text-center text-gray-500 text-xs py-8">
            No walls yet.<br />Set room size or add walls manually.
          </div>
        )}
        {walls.map(w => (
          <WallCard key={w.id} wall={w} />
        ))}

        {columns.length > 0 && (
          <div className="text-xs text-gray-500 uppercase pt-2 border-t border-gray-700">Columns</div>
        )}
        {columns.map(c => (
          <ColumnCard key={c.id} column={c} />
        ))}
      </div>

      <div className="p-2 border-t border-gray-700 space-y-1.5">
        <button onClick={handleAddWall}
          className="w-full bg-blue-700 hover:bg-blue-600 text-xs py-1.5 rounded">
          + Add Wall
        </button>
        <button onClick={handleAddColumn}
          className="w-full bg-purple-700 hover:bg-purple-600 text-xs py-1.5 rounded">
          + Add Column
        </button>
      </div>
    </div>
  )
}
