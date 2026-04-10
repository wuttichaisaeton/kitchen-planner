import { create } from 'zustand'
import { Wall, Point2D, Opening, Column, GuideLine } from '../types/kitchen'
import { v4 as uuid } from 'uuid'

interface RoomState {
  walls: Wall[]
  columns: Column[]
  guides: GuideLine[]
  ceilingHeight: number
  selectedWallId: string | null
  setRoomRect: (w: number, d: number) => void
  addWall: (start: Point2D, end: Point2D) => void
  updateWall: (id: string, updates: Partial<Pick<Wall, 'start' | 'end' | 'thickness' | 'height'>>) => void
  removeWall: (id: string) => void
  selectWall: (id: string | null) => void
  addOpening: (wallId: string, type: 'door' | 'window') => void
  updateOpening: (wallId: string, openingId: string, updates: Partial<Opening>) => void
  removeOpening: (wallId: string, openingId: string) => void
  addColumn: (position: Point2D) => void
  updateColumn: (id: string, updates: Partial<Omit<Column, 'id'>>) => void
  removeColumn: (id: string) => void
  addGuide: (start: Point2D, end: Point2D) => void
  removeGuide: (id: string) => void
  clearWalls: () => void
}

export const useRoomStore = create<RoomState>((set) => ({
  walls: [],
  columns: [],
  guides: [],
  ceilingHeight: 2700,
  selectedWallId: null,

  setRoomRect: (w, d) => {
    const walls: Wall[] = [
      { id: uuid(), start: { x: 0, y: 0 }, end: { x: w, y: 0 }, thickness: 150, height: 2700, openings: [], label: 'Back Wall' },
      { id: uuid(), start: { x: w, y: 0 }, end: { x: w, y: d }, thickness: 150, height: 2700, openings: [], label: 'Right Wall' },
      { id: uuid(), start: { x: w, y: d }, end: { x: 0, y: d }, thickness: 150, height: 2700, openings: [], label: 'Front Wall' },
      { id: uuid(), start: { x: 0, y: d }, end: { x: 0, y: 0 }, thickness: 150, height: 2700, openings: [], label: 'Left Wall' },
    ]
    set({ walls })
  },

  addWall: (start, end) => set(s => ({
    walls: [...s.walls, { id: uuid(), start, end, thickness: 150, height: 2700, openings: [], label: `Wall ${s.walls.length + 1}` }]
  })),

  updateWall: (id, updates) => set(s => ({
    walls: s.walls.map(w => w.id === id ? { ...w, ...updates } : w)
  })),

  removeWall: (id) => set(s => ({
    walls: s.walls.filter(w => w.id !== id),
    selectedWallId: s.selectedWallId === id ? null : s.selectedWallId,
  })),

  selectWall: (id) => set({ selectedWallId: id }),

  addOpening: (wallId, type) => set(s => {
    const wall = s.walls.find(w => w.id === wallId)
    if (!wall) return s
    const dx = wall.end.x - wall.start.x
    const dy = wall.end.y - wall.start.y
    const wallLen = Math.sqrt(dx * dx + dy * dy)

    const opening: Opening = {
      id: uuid(),
      type,
      offsetFromStart: Math.max(200, (wallLen - (type === 'door' ? 900 : 1200)) / 2),
      width: type === 'door' ? 900 : 1200,
      height: type === 'door' ? 2100 : 1200,
      sillHeight: type === 'door' ? 0 : 900,
    }
    return {
      walls: s.walls.map(w => w.id === wallId ? { ...w, openings: [...w.openings, opening] } : w)
    }
  }),

  updateOpening: (wallId, openingId, updates) => set(s => ({
    walls: s.walls.map(w => w.id === wallId ? {
      ...w,
      openings: w.openings.map(o => o.id === openingId ? { ...o, ...updates } : o)
    } : w)
  })),

  removeOpening: (wallId, openingId) => set(s => ({
    walls: s.walls.map(w => w.id === wallId ? {
      ...w,
      openings: w.openings.filter(o => o.id !== openingId)
    } : w)
  })),

  addColumn: (position) => set(s => ({
    columns: [...s.columns, {
      id: uuid(),
      position,
      width: 300,
      depth: 300,
      height: 2700,
      label: `Column ${s.columns.length + 1}`,
    }]
  })),

  updateColumn: (id, updates) => set(s => ({
    columns: s.columns.map(c => c.id === id ? { ...c, ...updates } : c)
  })),

  removeColumn: (id) => set(s => ({
    columns: s.columns.filter(c => c.id !== id)
  })),

  addGuide: (start, end) => set(s => ({
    guides: [...s.guides, { id: uuid(), start, end }]
  })),

  removeGuide: (id) => set(s => ({
    guides: s.guides.filter(g => g.id !== id)
  })),

  clearWalls: () => set({ walls: [], columns: [], guides: [], selectedWallId: null }),
}))
