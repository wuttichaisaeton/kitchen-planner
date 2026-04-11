import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { PlacedItem } from '../types/kitchen'
import { catalogItems } from '../data/catalogItems'
import { v4 as uuid } from 'uuid'

interface PlacementState {
  items: PlacedItem[]
  selectedId: string | null
  nextX: number  // track next X position for auto-placement along back wall
  addItem: (catalogItemId: string, position?: { x: number; y: number; z: number }) => void
  moveItem: (id: string, position: { x: number; y: number; z: number }) => void
  rotateItem: (id: string) => void
  removeItem: (id: string) => void
  selectItem: (id: string | null) => void
  clearAll: () => void
}

const SNAP_THRESHOLD = 60 // mm — snap distance

export const usePlacementStore = create<PlacementState>()(persist((set, get) => ({
  items: [],
  selectedId: null,
  nextX: 0,

  addItem: (catalogItemId, position?) => {
    const catItem = catalogItems.find(c => c.id === catalogItemId)
    if (!catItem) return

    let pos: { x: number; y: number; z: number }

    if (position) {
      // Snap to grid (50mm)
      pos = {
        x: Math.round(position.x / 50) * 50,
        y: 0,
        z: Math.round(position.z / 50) * 50,
      }
    } else {
      // Auto-place along back wall (z=0), stacking left to right
      const state = get()
      pos = { x: state.nextX, y: 0, z: 0 }
    }

    // Snap to nearby items (align edges)
    const state = get()
    for (const existing of state.items) {
      const exCat = catalogItems.find(c => c.id === existing.catalogItemId)
      if (!exCat) continue

      // Snap right edge of existing to left edge of new
      const exRight = existing.position.x + exCat.width
      if (Math.abs(pos.x - exRight) < SNAP_THRESHOLD) {
        pos.x = exRight
      }
      // Snap left edge
      if (Math.abs(pos.x + catItem.width - existing.position.x) < SNAP_THRESHOLD) {
        pos.x = existing.position.x - catItem.width
      }
      // Snap Z (depth alignment)
      if (Math.abs(pos.z - existing.position.z) < SNAP_THRESHOLD) {
        pos.z = existing.position.z
      }
    }

    const item: PlacedItem = { id: uuid(), catalogItemId, position: pos, rotation: 0 }
    set(s => ({
      items: [...s.items, item],
      selectedId: item.id,
      nextX: pos.x + catItem.width,  // next item goes right after this one
    }))
  },

  moveItem: (id, position) => {
    const state = get()
    const movingItem = state.items.find(i => i.id === id)
    if (!movingItem) return
    const catItem = catalogItems.find(c => c.id === movingItem.catalogItemId)
    if (!catItem) return

    // Snap to grid
    let pos = {
      x: Math.round(position.x / 50) * 50,
      y: 0,
      z: Math.round(position.z / 50) * 50,
    }

    // Snap to walls (z=0 back wall)
    if (pos.z < SNAP_THRESHOLD) pos.z = 0

    // Snap to other items
    for (const other of state.items) {
      if (other.id === id) continue
      const otherCat = catalogItems.find(c => c.id === other.catalogItemId)
      if (!otherCat) continue

      // Right edge snap
      const otherRight = other.position.x + otherCat.width
      if (Math.abs(pos.x - otherRight) < SNAP_THRESHOLD) pos.x = otherRight
      // Left edge snap
      if (Math.abs(pos.x + catItem.width - other.position.x) < SNAP_THRESHOLD) {
        pos.x = other.position.x - catItem.width
      }
      // Z align
      if (Math.abs(pos.z - other.position.z) < SNAP_THRESHOLD) pos.z = other.position.z
    }

    set(s => ({
      items: s.items.map(i => i.id === id ? { ...i, position: pos } : i)
    }))
  },

  rotateItem: (id) => set(s => ({
    items: s.items.map(i => i.id === id ? { ...i, rotation: i.rotation + Math.PI / 2 } : i)
  })),

  removeItem: (id) => set(s => ({
    items: s.items.filter(i => i.id !== id),
    selectedId: s.selectedId === id ? null : s.selectedId,
  })),

  selectItem: (id) => set({ selectedId: id }),
  clearAll: () => set({ items: [], selectedId: null, nextX: 0 }),
}), {
  name: 'kp-placement',
  partialize: (state) => ({
    items: state.items,
    nextX: state.nextX,
  }),
}))
