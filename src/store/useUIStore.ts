import { create } from 'zustand'

type ViewMode = '2d' | '3d'
type ActiveTool = 'select' | 'wall' | 'place'
type SidePanel = 'catalog' | 'properties' | 'quotation'
type LeftTab = 'catalog' | 'walls'
export type SketchTool = 'select' | 'line' | 'rectangle' | 'dimension' | 'door' | 'window' | 'column' | 'trim' | 'construction' | 'offset' | 'fillet' | 'mirror' | 'hv' | 'perpendicular' | 'fix' | 'equal' | 'parallel' | 'coincident' | 'symmetric'

const DEFAULT_FAVORITES: SketchTool[] = ['select', 'line', 'rectangle', 'door', 'window', 'dimension', 'trim']

function loadFavorites(): SketchTool[] {
  try {
    const saved = localStorage.getItem('kp-favorite-tools')
    if (saved) return JSON.parse(saved)
  } catch { /* ignore */ }
  return DEFAULT_FAVORITES
}

function saveFavorites(favs: SketchTool[]) {
  try { localStorage.setItem('kp-favorite-tools', JSON.stringify(favs)) } catch { /* ignore */ }
}

interface UIState {
  viewMode: ViewMode
  activeTool: ActiveTool
  sidePanel: SidePanel
  dragCatalogId: string | null
  leftOpen: boolean
  rightOpen: boolean
  leftTab: LeftTab
  sketchTool: SketchTool
  lastSketchTool: SketchTool
  favoriteTools: SketchTool[]
  setViewMode: (m: ViewMode) => void
  setActiveTool: (t: ActiveTool) => void
  setSidePanel: (p: SidePanel) => void
  setDragCatalogId: (id: string | null) => void
  toggleLeft: () => void
  toggleRight: () => void
  setLeftTab: (t: LeftTab) => void
  setSketchTool: (t: SketchTool) => void
  toggleFavoriteTool: (t: SketchTool) => void
}

export const useUIStore = create<UIState>((set) => ({
  viewMode: '3d',
  activeTool: 'select',
  sidePanel: 'catalog',
  dragCatalogId: null,
  leftOpen: false,
  rightOpen: false,
  leftTab: 'catalog',
  sketchTool: 'line',
  lastSketchTool: 'line',
  favoriteTools: loadFavorites(),
  setViewMode: (viewMode) => set({ viewMode }),
  setActiveTool: (activeTool) => set({ activeTool }),
  setSidePanel: (sidePanel) => set({ sidePanel }),
  setDragCatalogId: (dragCatalogId) => set({ dragCatalogId }),
  toggleLeft: () => set(s => ({ leftOpen: !s.leftOpen })),
  toggleRight: () => set(s => ({ rightOpen: !s.rightOpen })),
  setLeftTab: (leftTab) => set({ leftTab, leftOpen: true }),
  setSketchTool: (sketchTool) => set(s => ({ sketchTool, lastSketchTool: s.sketchTool !== 'select' ? s.sketchTool : s.lastSketchTool })),
  toggleFavoriteTool: (tool) => set(s => {
    const favs = s.favoriteTools.includes(tool)
      ? s.favoriteTools.filter(t => t !== tool)
      : [...s.favoriteTools, tool]
    saveFavorites(favs)
    return { favoriteTools: favs }
  }),
}))
