import { create } from 'zustand'
import { Wall, Point2D, Opening, Column, GuideLine } from '../types/kitchen'
import { v4 as uuid } from 'uuid'

// Auto-join threshold in mm (world space — zoom independent)
// Auto-join within 10mm
const JOIN_THRESHOLD = 10

// Find nearest existing endpoint within threshold
function findNearestEndpoint(pt: Point2D, walls: Wall[], excludeId?: string): Point2D | null {
  let bestDist = JOIN_THRESHOLD
  let bestPt: Point2D | null = null
  for (const w of walls) {
    if (w.id === excludeId) continue
    for (const ep of [w.start, w.end]) {
      const d = Math.sqrt((pt.x - ep.x) ** 2 + (pt.y - ep.y) ** 2)
      if (d < bestDist) {
        bestDist = d
        bestPt = { x: ep.x, y: ep.y }
      }
    }
  }
  return bestPt
}

// Auto-join: snap wall endpoints to nearby existing endpoints
function autoJoinWall(wall: Wall, existingWalls: Wall[]): Wall {
  const startSnap = findNearestEndpoint(wall.start, existingWalls, wall.id)
  const endSnap = findNearestEndpoint(wall.end, existingWalls, wall.id)
  return {
    ...wall,
    start: startSnap || wall.start,
    end: endSnap || wall.end,
  }
}

// Enforce H/V constraints on all walls, cascading through connected endpoints
// Returns new walls array with all constraints satisfied
// Strategy: H-constrained walls keep start.y, V-constrained walls keep start.x
// Then propagate moved endpoints to all connected walls
// Dimension-aware BFS propagation:
// When a point moves, dimensioned walls TRANSLATE (keep length), undimensioned walls STRETCH.
function propagateDimensionAware(
  result: Wall[],
  movedWallId: string,
  oldPt: Point2D,
  newPt: Point2D
) {
  const EPS = 5
  const deltaX = newPt.x - oldPt.x
  const deltaY = newPt.y - oldPt.y
  if (Math.abs(deltaX) < 0.1 && Math.abs(deltaY) < 0.1) return

  // BFS queue: { oldX, oldY, newX, newY, sourceWallId }
  const queue: { oldX: number; oldY: number; newX: number; newY: number; sourceId: string }[] = [
    { oldX: oldPt.x, oldY: oldPt.y, newX: newPt.x, newY: newPt.y, sourceId: movedWallId }
  ]
  const visited = new Set<string>()
  visited.add(movedWallId)

  while (queue.length > 0) {
    const { oldX, oldY, newX, newY, sourceId } = queue.shift()!
    const dx = newX - oldX
    const dy = newY - oldY

    for (const w of result) {
      if (visited.has(w.id)) continue

      // Check if this wall is connected at the moved point
      const startMatch = Math.abs(w.start.x - oldX) < EPS && Math.abs(w.start.y - oldY) < EPS
      const endMatch = Math.abs(w.end.x - oldX) < EPS && Math.abs(w.end.y - oldY) < EPS
      if (!startMatch && !endMatch) continue

      if (w.dimensionValue) {
        // DIMENSIONED wall: translate the whole wall (preserve length)
        visited.add(w.id)
        if (startMatch) {
          const otherOldX = w.end.x, otherOldY = w.end.y
          w.start.x = newX; w.start.y = newY
          w.end.x += dx; w.end.y += dy
          // Queue propagation from the other end
          queue.push({ oldX: otherOldX, oldY: otherOldY, newX: w.end.x, newY: w.end.y, sourceId: w.id })
        }
        if (endMatch) {
          const otherOldX = w.start.x, otherOldY = w.start.y
          w.end.x = newX; w.end.y = newY
          w.start.x += dx; w.start.y += dy
          queue.push({ oldX: otherOldX, oldY: otherOldY, newX: w.start.x, newY: w.start.y, sourceId: w.id })
        }
      } else {
        // UNDIMENSIONED wall: only move the connected endpoint (stretch/shrink)
        visited.add(w.id)
        if (startMatch) {
          w.start.x = newX; w.start.y = newY
        }
        if (endMatch) {
          w.end.x = newX; w.end.y = newY
        }
        // Don't propagate further — this wall absorbs the change
      }
    }
  }
}

function enforceAllConstraints(walls: Wall[]): Wall[] {
  const EPS = 5
  let result = walls.map(w => ({ ...w, start: { ...w.start }, end: { ...w.end } }))

  // Enforce H/V constraints with propagation
  for (let pass = 0; pass < 5; pass++) {
    let changed = false

    for (let i = 0; i < result.length; i++) {
      const w = result[i]
      if (!w.constraint) continue

      const oldEndX = w.end.x, oldEndY = w.end.y

      if (w.constraint === 'H' && Math.abs(w.start.y - w.end.y) > 0.1) {
        w.end.y = w.start.y
        changed = true
      }
      if (w.constraint === 'V' && Math.abs(w.start.x - w.end.x) > 0.1) {
        w.end.x = w.start.x
        changed = true
      }

      // Simple propagation for H/V enforcement (not dimension-aware here)
      if (oldEndX !== w.end.x || oldEndY !== w.end.y) {
        for (let j = 0; j < result.length; j++) {
          if (i === j) continue
          const other = result[j]
          if (Math.abs(other.start.x - oldEndX) < EPS && Math.abs(other.start.y - oldEndY) < EPS) {
            other.start.x = w.end.x; other.start.y = w.end.y
          }
          if (Math.abs(other.end.x - oldEndX) < EPS && Math.abs(other.end.y - oldEndY) < EPS) {
            other.end.x = w.end.x; other.end.y = w.end.y
          }
        }
      }
    }

    if (!changed) break
  }

  return result
}

interface HistoryEntry {
  walls: Wall[]
  columns: Column[]
  guides: GuideLine[]
}

const MAX_HISTORY = 50

interface RoomState {
  walls: Wall[]
  columns: Column[]
  guides: GuideLine[]
  ceilingHeight: number
  selectedWallId: string | null
  _history: HistoryEntry[]
  _historyIndex: number
  pushHistory: () => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  setRoomRect: (w: number, d: number) => void
  addWall: (start: Point2D, end: Point2D) => void
  updateWall: (id: string, updates: Partial<Pick<Wall, 'start' | 'end' | 'thickness' | 'height' | 'constraint' | 'dimensionValue'>>) => void
  removeWall: (id: string) => void
  selectWall: (id: string | null) => void
  addOpening: (wallId: string, type: 'door' | 'window' | 'fixed-glass', offsetMM?: number, widthMM?: number) => void
  updateOpening: (wallId: string, openingId: string, updates: Partial<Opening>) => void
  updateOpeningNoHistory: (wallId: string, openingId: string, updates: Partial<Opening>) => void
  removeOpening: (wallId: string, openingId: string) => void
  addColumn: (position: Point2D) => void
  updateColumn: (id: string, updates: Partial<Omit<Column, 'id'>>) => void
  removeColumn: (id: string) => void
  addGuide: (start: Point2D, end: Point2D) => void
  removeGuide: (id: string) => void
  applyHVConstraint: (wallId: string) => void
  applyHVConstraintAll: () => void
  applyDimension: (wallId: string, newLength: number) => void
  isOverConstrained: (wallId: string) => boolean
  removeDimension: (wallId: string) => void
  applyCoincident: (wallId: string, part: 'start' | 'end', targetPoint: Point2D) => void
  autoJoinAll: () => void
  enforceConstraints: () => void
  clearWalls: () => void
}

export const useRoomStore = create<RoomState>((set, get) => ({
  walls: [],
  columns: [],
  guides: [],
  ceilingHeight: 2700,
  selectedWallId: null,
  _history: [],
  _historyIndex: -1,

  // Save current state to history BEFORE making a change
  // Call this manually at the START of meaningful operations (not during drag)
  pushHistory: () => {
    const { walls, columns, guides, _history, _historyIndex } = get()
    const entry: HistoryEntry = {
      walls: JSON.parse(JSON.stringify(walls)),
      columns: JSON.parse(JSON.stringify(columns)),
      guides: JSON.parse(JSON.stringify(guides)),
    }
    // Truncate any future history (redo stack) when new action happens
    const newHistory = _history.slice(0, _historyIndex + 1)
    newHistory.push(entry)
    if (newHistory.length > MAX_HISTORY) newHistory.shift()
    set({ _history: newHistory, _historyIndex: newHistory.length - 1 })
  },

  undo: () => {
    const { _history, _historyIndex } = get()
    if (_historyIndex < 0) return
    // Save current state so redo can restore it
    const { walls, columns, guides } = get()
    const currentEntry: HistoryEntry = {
      walls: JSON.parse(JSON.stringify(walls)),
      columns: JSON.parse(JSON.stringify(columns)),
      guides: JSON.parse(JSON.stringify(guides)),
    }
    // Put current state at _historyIndex + 1 for redo
    const newHistory = [..._history]
    // If there's no "future" entry yet, add one
    if (_historyIndex + 1 >= newHistory.length) {
      newHistory.push(currentEntry)
    } else {
      newHistory[_historyIndex + 1] = currentEntry
    }

    const entry = _history[_historyIndex]
    set({
      walls: JSON.parse(JSON.stringify(entry.walls)),
      columns: JSON.parse(JSON.stringify(entry.columns)),
      guides: JSON.parse(JSON.stringify(entry.guides)),
      _history: newHistory,
      _historyIndex: _historyIndex - 1,
    })
  },

  redo: () => {
    const { _history, _historyIndex } = get()
    const redoIndex = _historyIndex + 2
    if (redoIndex >= _history.length) return
    // Save current state back
    const { walls, columns, guides } = get()
    const currentEntry: HistoryEntry = {
      walls: JSON.parse(JSON.stringify(walls)),
      columns: JSON.parse(JSON.stringify(columns)),
      guides: JSON.parse(JSON.stringify(guides)),
    }
    const newHistory = [..._history]
    newHistory[_historyIndex + 1] = currentEntry

    const entry = _history[redoIndex]
    set({
      walls: JSON.parse(JSON.stringify(entry.walls)),
      columns: JSON.parse(JSON.stringify(entry.columns)),
      guides: JSON.parse(JSON.stringify(entry.guides)),
      _history: newHistory,
      _historyIndex: _historyIndex + 1,
    })
  },

  canUndo: () => get()._historyIndex >= 0,
  canRedo: () => get()._historyIndex + 2 < get()._history.length,

  setRoomRect: (w, d) => {
    get().pushHistory()
    const walls: Wall[] = [
      { id: uuid(), start: { x: 0, y: 0 }, end: { x: w, y: 0 }, thickness: 150, height: 2700, openings: [], label: 'Back Wall' },
      { id: uuid(), start: { x: w, y: 0 }, end: { x: w, y: d }, thickness: 150, height: 2700, openings: [], label: 'Right Wall' },
      { id: uuid(), start: { x: w, y: d }, end: { x: 0, y: d }, thickness: 150, height: 2700, openings: [], label: 'Front Wall' },
      { id: uuid(), start: { x: 0, y: d }, end: { x: 0, y: 0 }, thickness: 150, height: 2700, openings: [], label: 'Left Wall' },
    ]
    set({ walls })
  },

  addWall: (start, end) => {
    get().pushHistory()
    set(s => {
      const newWall: Wall = { id: uuid(), start, end, thickness: 150, height: 2700, openings: [], label: `Wall ${s.walls.length + 1}` }
      // Auto-join: snap endpoints to nearby existing wall endpoints
      const joined = autoJoinWall(newWall, s.walls)
      return { walls: [...s.walls, joined] }
    })
  },

  // NO history push here — caller must call pushHistory() before drag starts
  updateWall: (id, updates) => {
    set(s => ({
      walls: s.walls.map(w => w.id === id ? { ...w, ...updates } : w)
    }))
  },

  removeWall: (id) => {
    get().pushHistory()
    set(s => ({
      walls: s.walls.filter(w => w.id !== id),
      selectedWallId: s.selectedWallId === id ? null : s.selectedWallId,
    }))
  },

  selectWall: (id) => set({ selectedWallId: id }),

  addOpening: (wallId, type, offsetMM, widthMM) => {
    get().pushHistory()
    set(s => {
      const wall = s.walls.find(w => w.id === wallId)
      if (!wall) return s
      const dx = wall.end.x - wall.start.x
      const dy = wall.end.y - wall.start.y
      const wallLen = Math.sqrt(dx * dx + dy * dy)
      const openingW = widthMM ?? (type === 'door' ? 900 : 1200)

      // Use provided offset or center on wall
      let offset = offsetMM ?? (wallLen - openingW) / 2
      // Clamp: at least 0, at most wallLen - openingW
      offset = Math.max(0, Math.min(wallLen - openingW, offset))
      // Snap to 50mm grid
      offset = Math.round(offset / 50) * 50

      const opening: Opening = {
        id: uuid(),
        type,
        offsetFromStart: offset,
        width: Math.round(openingW / 50) * 50,
        height: type === 'door' ? 2100 : 1200,
        sillHeight: type === 'door' ? 0 : 900,
      }
      return {
        walls: s.walls.map(w => w.id === wallId ? { ...w, openings: [...w.openings, opening] } : w)
      }
    })
  },

  updateOpening: (wallId, openingId, updates) => {
    get().pushHistory()
    set(s => ({
      walls: s.walls.map(w => w.id === wallId ? {
        ...w,
        openings: w.openings.map(o => o.id === openingId ? { ...o, ...updates } : o)
      } : w)
    }))
  },

  updateOpeningNoHistory: (wallId, openingId, updates) => {
    set(s => ({
      walls: s.walls.map(w => w.id === wallId ? {
        ...w,
        openings: w.openings.map(o => o.id === openingId ? { ...o, ...updates } : o)
      } : w)
    }))
  },

  removeOpening: (wallId, openingId) => {
    get().pushHistory()
    set(s => ({
      walls: s.walls.map(w => w.id === wallId ? {
        ...w,
        openings: w.openings.filter(o => o.id !== openingId)
      } : w)
    }))
  },

  addColumn: (position) => {
    get().pushHistory()
    set(s => ({
      columns: [...s.columns, {
        id: uuid(),
        position,
        width: 300,
        depth: 300,
        height: 2700,
        label: `Column ${s.columns.length + 1}`,
      }]
    }))
  },

  // NO history push — caller must call pushHistory() before drag starts
  updateColumn: (id, updates) => {
    set(s => ({
      columns: s.columns.map(c => c.id === id ? { ...c, ...updates } : c)
    }))
  },

  removeColumn: (id) => {
    get().pushHistory()
    set(s => ({
      columns: s.columns.filter(c => c.id !== id)
    }))
  },

  addGuide: (start, end) => {
    get().pushHistory()
    set(s => ({
      guides: [...s.guides, { id: uuid(), start, end }]
    }))
  },

  removeGuide: (id) => {
    get().pushHistory()
    set(s => ({
      guides: s.guides.filter(g => g.id !== id)
    }))
  },

  // Apply H/V constraint atomically — moves wall + all connected walls in one operation
  applyHVConstraint: (wallId: string) => {
    get().pushHistory()
    const { walls } = get()
    const w = walls.find(ww => ww.id === wallId)
    if (!w) return

    // If already constrained, toggle off
    if (w.constraint) {
      set(s => ({ walls: s.walls.map(ww => ww.id === wallId ? { ...ww, constraint: null } : ww) }))
      return
    }

    const ddx = Math.abs(w.end.x - w.start.x)
    const ddy = Math.abs(w.end.y - w.start.y)
    const EPS = 5

    // Compute new positions
    let newWalls = walls.map(ww => ({ ...ww, start: { ...ww.start }, end: { ...ww.end } }))
    const target = newWalls.find(ww => ww.id === wallId)!
    const oldStart = { ...target.start }
    const oldEnd = { ...target.end }

    if (ddx >= ddy) {
      // Horizontal — align Y to start.y (keep start as anchor)
      const y = target.start.y
      target.end.y = y
      target.constraint = 'H'
    } else {
      // Vertical — align X to start.x (keep start as anchor)
      const x = target.start.x
      target.end.x = x
      target.constraint = 'V'
    }

    // Dimension-aware BFS propagation from both endpoints
    propagateDimensionAware(newWalls, wallId, oldEnd, target.end)
    propagateDimensionAware(newWalls, wallId, oldStart, target.start)

    // Enforce H/V constraints
    newWalls = enforceAllConstraints(newWalls)
    set({ walls: newWalls })
  },

  // Apply H/V constraint to ALL walls at once (single undo step)
  applyHVConstraintAll: () => {
    get().pushHistory()
    const { walls } = get()
    let newWalls = walls.map(ww => ({ ...ww, start: { ...ww.start }, end: { ...ww.end } }))

    newWalls.forEach(w => {
      if (w.constraint) return // already constrained, skip
      const ddx = Math.abs(w.end.x - w.start.x)
      const ddy = Math.abs(w.end.y - w.start.y)
      if (ddx >= ddy) {
        w.end.y = w.start.y
        w.constraint = 'H'
      } else {
        w.end.x = w.start.x
        w.constraint = 'V'
      }
    })

    newWalls = enforceAllConstraints(newWalls)
    set({ walls: newWalls })
  },

  // Apply dimension atomically — resize wall + move connected walls
  // Dimensioned walls translate (keep length), undimensioned walls absorb
  applyDimension: (wallId: string, newLength: number) => {
    get().pushHistory()
    const { walls } = get()
    const w = walls.find(ww => ww.id === wallId)
    if (!w) return

    const dx = w.end.x - w.start.x
    const dy = w.end.y - w.start.y
    const curLen = Math.sqrt(dx * dx + dy * dy)
    if (curLen < 1) return

    const snap50 = (v: number) => Math.round(v / 50) * 50
    const ratio = newLength / curLen
    const newEnd = { x: snap50(w.start.x + dx * ratio), y: snap50(w.start.y + dy * ratio) }
    const oldEnd = { ...w.end }

    let newWalls = walls.map(ww => ({ ...ww, start: { ...ww.start }, end: { ...ww.end } }))
    const target = newWalls.find(ww => ww.id === wallId)!
    target.end = newEnd
    target.dimensionValue = newLength

    // Dimension-aware BFS: dimensioned walls translate, undimensioned stretch
    propagateDimensionAware(newWalls, wallId, oldEnd, newEnd)

    // Enforce H/V constraints
    newWalls = enforceAllConstraints(newWalls)
    set({ walls: newWalls })
  },

  // Check if dimensioning this wall would over-constrain the sketch
  // For a closed polygon with H/V constraints:
  // If all other H walls are dimensioned → this H wall is fully determined
  // Same for V walls
  isOverConstrained: (wallId: string) => {
    const { walls } = get()
    const w = walls.find(ww => ww.id === wallId)
    if (!w) return false
    if (w.dimensionValue) return false // already dimensioned — allow editing

    // Find which direction this wall primarily goes
    const dx = Math.abs(w.end.x - w.start.x)
    const dy = Math.abs(w.end.y - w.start.y)
    const isH = dx >= dy // horizontal-ish

    // Find all walls with same orientation (H or V constrained, or close to it)
    const sameDir = walls.filter(ww => {
      if (!ww.constraint) {
        const wdx = Math.abs(ww.end.x - ww.start.x)
        const wdy = Math.abs(ww.end.y - ww.start.y)
        return isH ? wdx >= wdy : wdy > wdx
      }
      return isH ? ww.constraint === 'H' : ww.constraint === 'V'
    })

    // If all OTHER walls in same direction are dimensioned → this wall is over-constrained
    const othersInDir = sameDir.filter(ww => ww.id !== wallId)
    if (othersInDir.length === 0) return false

    const allOthersDimensioned = othersInDir.every(ww => !!ww.dimensionValue)
    return allOthersDimensioned
  },

  // Remove dimension from a wall (un-dimension it)
  removeDimension: (wallId: string) => {
    get().pushHistory()
    set(s => ({
      walls: s.walls.map(w => w.id === wallId ? { ...w, dimensionValue: undefined } : w)
    }))
  },

  // Coincident constraint — move a wall's endpoint to a target point, propagate to all connected walls
  applyCoincident: (wallId: string, part: 'start' | 'end', targetPoint: Point2D) => {
    get().pushHistory()
    const { walls } = get()
    const EPS = 5

    // Find the wall and its current endpoint position
    const wall = walls.find(w => w.id === wallId)
    if (!wall) return
    const oldPt = wall[part]

    // Move this wall's endpoint + propagate to all walls sharing the same old point
    let newWalls = walls.map(w => {
      const updated = { ...w }
      if (Math.abs(w.start.x - oldPt.x) < EPS && Math.abs(w.start.y - oldPt.y) < EPS) {
        updated.start = { x: targetPoint.x, y: targetPoint.y }
      }
      if (Math.abs(w.end.x - oldPt.x) < EPS && Math.abs(w.end.y - oldPt.y) < EPS) {
        updated.end = { x: targetPoint.x, y: targetPoint.y }
      }
      return updated
    })

    // Enforce H/V constraints after merge
    newWalls = enforceAllConstraints(newWalls)
    set({ walls: newWalls })
  },

  // Auto-join all walls — merge any endpoints within threshold
  autoJoinAll: () => {
    const { walls } = get()
    let changed = false
    const newWalls = walls.map(w => {
      const joined = autoJoinWall(w, walls)
      if (joined.start.x !== w.start.x || joined.start.y !== w.start.y ||
          joined.end.x !== w.end.x || joined.end.y !== w.end.y) {
        changed = true
      }
      return joined
    })
    if (changed) set({ walls: newWalls })
  },

  // Re-enforce all H/V constraints + cascade to connected walls
  enforceConstraints: () => {
    const { walls } = get()
    const enforced = enforceAllConstraints(walls)
    // Check if anything changed
    let changed = false
    for (let i = 0; i < walls.length; i++) {
      if (walls[i].start.x !== enforced[i].start.x || walls[i].start.y !== enforced[i].start.y ||
          walls[i].end.x !== enforced[i].end.x || walls[i].end.y !== enforced[i].end.y) {
        changed = true
        break
      }
    }
    if (changed) set({ walls: enforced })
  },

  clearWalls: () => {
    get().pushHistory()
    set({ walls: [], columns: [], guides: [], selectedWallId: null })
  },
}))
