import { create } from 'zustand'

type ViewMode = '2d' | '3d'
type ActiveTool = 'select' | 'wall' | 'place'
type SidePanel = 'catalog' | 'properties' | 'quotation'
type LeftTab = 'catalog' | 'walls'
export type SketchTool = 'select' | 'line' | 'rectangle' | 'dimension' | 'door' | 'window' | 'fixed-glass' | 'column' | 'trim' | 'construction' | 'offset' | 'fillet' | 'mirror' | 'hv' | 'perpendicular' | 'fix' | 'equal' | 'parallel' | 'coincident' | 'symmetric'

export interface OpeningPreset {
  type: 'door' | 'window' | 'fixed-glass'
  width: number       // mm
  height: number      // mm
  sillHeight: number   // mm (window only)
  hingePosition: 'start' | 'end'
  swingSide: 'inside' | 'outside'
}

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
  openingPreset: OpeningPreset | null
  showOpeningDialog: boolean
  setViewMode: (m: ViewMode) => void
  setActiveTool: (t: ActiveTool) => void
  setSidePanel: (p: SidePanel) => void
  setDragCatalogId: (id: string | null) => void
  toggleLeft: () => void
  toggleRight: () => void
  setLeftTab: (t: LeftTab) => void
  setSketchTool: (t: SketchTool) => void
  toggleFavoriteTool: (t: SketchTool) => void
  setOpeningPreset: (p: OpeningPreset | null) => void
  setShowOpeningDialog: (v: boolean) => void
  confirmOpeningPreset: (p: OpeningPreset) => void
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
  openingPreset: null,
  showOpeningDialog: false,
  setViewMode: (viewMode) => set({ viewMode }),
  setActiveTool: (activeTool) => set({ activeTool }),
  setSidePanel: (sidePanel) => set({ sidePanel }),
  setDragCatalogId: (dragCatalogId) => set({ dragCatalogId }),
  toggleLeft: () => set(s => ({ leftOpen: !s.leftOpen })),
  toggleRight: () => set(s => ({ rightOpen: !s.rightOpen })),
  setLeftTab: (leftTab) => set({ leftTab, leftOpen: true }),
  setSketchTool: (sketchTool) => set(s => {
    // When selecting door/window tool, show dialog first
    if (sketchTool === 'door' || sketchTool === 'window' || sketchTool === 'fixed-glass') {
      const openingType = sketchTool === 'door' ? 'door' : sketchTool === 'window' ? 'window' : 'fixed-glass'
      return {
        sketchTool,
        lastSketchTool: s.sketchTool !== 'select' ? s.sketchTool : s.lastSketchTool,
        showOpeningDialog: true,
        openingPreset: s.openingPreset?.type === openingType ? s.openingPreset : {
          type: openingType,
          width: sketchTool === 'door' ? 900 : 1200,
          height: sketchTool === 'door' ? 2100 : 1200,
          sillHeight: sketchTool === 'door' ? 0 : 900,
          hingePosition: 'start',
          swingSide: 'inside',
        },
      }
    }
    return { sketchTool, lastSketchTool: s.sketchTool !== 'select' ? s.sketchTool : s.lastSketchTool }
  }),
  setOpeningPreset: (openingPreset) => set({ openingPreset }),
  setShowOpeningDialog: (showOpeningDialog) => set({ showOpeningDialog }),
  confirmOpeningPreset: (preset) => set({ openingPreset: preset, showOpeningDialog: false }),
  toggleFavoriteTool: (tool) => set(s => {
    const favs = s.favoriteTools.includes(tool)
      ? s.favoriteTools.filter(t => t !== tool)
      : [...s.favoriteTools, tool]
    saveFavorites(favs)
    return { favoriteTools: favs }
  }),
}))
