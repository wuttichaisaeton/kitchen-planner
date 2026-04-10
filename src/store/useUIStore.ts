import { create } from 'zustand'

type ViewMode = '2d' | '3d'
type ActiveTool = 'select' | 'wall' | 'place'
type SidePanel = 'catalog' | 'properties' | 'quotation'
type LeftTab = 'catalog' | 'walls'
export type SketchTool = 'select' | 'line' | 'rectangle' | 'dimension' | 'door' | 'window' | 'column' | 'trim' | 'construction' | 'offset' | 'fillet' | 'mirror' | 'hv' | 'perpendicular' | 'fix' | 'equal' | 'parallel' | 'coincident' | 'symmetric'

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
  setViewMode: (m: ViewMode) => void
  setActiveTool: (t: ActiveTool) => void
  setSidePanel: (p: SidePanel) => void
  setDragCatalogId: (id: string | null) => void
  toggleLeft: () => void
  toggleRight: () => void
  setLeftTab: (t: LeftTab) => void
  setSketchTool: (t: SketchTool) => void
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
  setViewMode: (viewMode) => set({ viewMode }),
  setActiveTool: (activeTool) => set({ activeTool }),
  setSidePanel: (sidePanel) => set({ sidePanel }),
  setDragCatalogId: (dragCatalogId) => set({ dragCatalogId }),
  toggleLeft: () => set(s => ({ leftOpen: !s.leftOpen })),
  toggleRight: () => set(s => ({ rightOpen: !s.rightOpen })),
  setLeftTab: (leftTab) => set({ leftTab, leftOpen: true }),
  setSketchTool: (sketchTool) => set(s => ({ sketchTool, lastSketchTool: s.sketchTool !== 'select' ? s.sketchTool : s.lastSketchTool })),
}))
