export type Point2D = { x: number; y: number }

export interface Opening {
  id: string
  type: 'door' | 'window' | 'fixed-glass'
  offsetFromStart: number
  width: number
  height: number
  sillHeight: number
  hingePosition?: 'start' | 'end'   // Which end of opening has hinge (default 'start')
  swingSide?: 'inside' | 'outside'  // Which side door swings to (default 'inside' = normal side)
}

export type WallConstraint = 'H' | 'V' | null

export interface Wall {
  id: string
  start: Point2D
  end: Point2D
  thickness: number
  height: number
  openings: Opening[]
  label?: string
  constraint?: WallConstraint
  dimensionValue?: number // User-set dimension length in mm (undefined = not dimensioned)
}

export interface Column {
  id: string
  position: Point2D
  width: number
  depth: number
  height: number
  label?: string
}

export interface GuideLine {
  id: string
  start: Point2D
  end: Point2D
}

export type Category = 'base-cabinet' | 'wall-cabinet' | 'countertop' | 'sink' | 'accessory'

export interface CatalogItem {
  id: string
  category: Category
  nameTH: string
  nameEN: string
  width: number
  depth: number
  height: number
  materialThickness: number
  priceBase: number
}

export interface PlacedItem {
  id: string
  catalogItemId: string
  position: { x: number; y: number; z: number }
  rotation: number
  snappedToWallId?: string
  customWidth?: number
}

export interface BOMLine {
  catalogItem: CatalogItem
  qty: number
  unitPrice: number
  lineTotal: number
}

export interface Quotation {
  customerName: string
  date: string
  items: BOMLine[]
  subtotal: number
  laborCost: number
  margin: number
  vat: number
  grandTotal: number
}
