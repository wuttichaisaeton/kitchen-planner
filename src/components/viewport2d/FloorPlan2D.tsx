import { useRef, useEffect, useState, useCallback } from 'react'
import { useRoomStore } from '../../store/useRoomStore'
import { useUIStore } from '../../store/useUIStore'
import { usePlacementStore } from '../../store/usePlacementStore'
import { catalogItems } from '../../data/catalogItems'
import { Wall, Point2D } from '../../types/kitchen'
import type { UseLeicaDistoReturn } from '../../hooks/useLeicaDisto'
import ContextMenu from './ContextMenu'
import OpeningDialog from './OpeningDialog'

const GRID_SIZE = 100
const SNAP = 50
const SNAP_RADIUS_PX = 15 // px for visual snap indicator
const SNAP_WORLD = 10 // mm — joint within 10mm radius

function snap(v: number) {
  return Math.round(v / SNAP) * SNAP
}

function wallLength(w: Wall) {
  const dx = w.end.x - w.start.x
  const dy = w.end.y - w.start.y
  return Math.sqrt(dx * dx + dy * dy)
}

type DragTarget =
  | { type: 'wall-start'; wallId: string }
  | { type: 'wall-end'; wallId: string }
  | { type: 'wall-move'; wallId: string; offsetX: number; offsetY: number }
  | { type: 'column-move'; columnId: string; offsetX: number; offsetY: number }
  | { type: 'opening-move'; wallId: string; openingId: string }
  | { type: 'pan'; startPanX: number; startPanY: number; startMouseX: number; startMouseY: number }
  | null

interface FloorPlan2DProps {
  distoHook?: UseLeicaDistoReturn
}

export default function FloorPlan2D({ distoHook }: FloorPlan2DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const walls = useRoomStore(s => s.walls)
  const columns = useRoomStore(s => s.columns)
  const guides = useRoomStore(s => s.guides)
  const updateWall = useRoomStore(s => s.updateWall)
  const selectWall = useRoomStore(s => s.selectWall)
  const selectedWallId = useRoomStore(s => s.selectedWallId)
  const addWall = useRoomStore(s => s.addWall)
  const addOpening = useRoomStore(s => s.addOpening)
  const addColumn = useRoomStore(s => s.addColumn)
  const updateColumn = useRoomStore(s => s.updateColumn)
  const addGuide = useRoomStore(s => s.addGuide)
  const removeWall = useRoomStore(s => s.removeWall)
  const removeGuide = useRoomStore(s => s.removeGuide)
  const removeColumn = useRoomStore(s => s.removeColumn)
  const items = usePlacementStore(s => s.items)
  const sketchTool = useUIStore(s => s.sketchTool)
  const setSketchTool = useUIStore(s => s.setSketchTool)

  const [panX, setPanX] = useState(200)
  const [panY, setPanY] = useState(100)
  const [scale, setScale] = useState(0.15)

  const [dragTarget, setDragTarget] = useState<DragTarget>(null)
  const [hoverWallId, setHoverWallId] = useState<string | null>(null)
  const [hoveredConstraintWallId, setHoveredConstraintWallId] = useState<string | null>(null)
  const [selectedConstraintWallId, setSelectedConstraintWallId] = useState<string | null>(null)

  // Canvas mount trigger
  const [canvasReady, setCanvasReady] = useState(0)

  // Drawing state for line tool
  const [drawStart, setDrawStart] = useState<Point2D | null>(null)
  const [mouseWorld, setMouseWorld] = useState<Point2D>({ x: 0, y: 0 })

  // Drawing state for rectangle tool
  const [rectStart, setRectStart] = useState<Point2D | null>(null)

  // Constraint: first wall selected (for two-click constraints)
  const [constraintFirstWallId, setConstraintFirstWallId] = useState<string | null>(null)

  // Coincident: first selected point { wallId, part, point }
  const [coincidentFirst, setCoincidentFirst] = useState<{ wallId: string; part: 'start' | 'end'; point: Point2D } | null>(null)

  // Lasso join — drag circle around endpoints to merge them
  const [lassoStart, setLassoStart] = useState<{ sx: number; sy: number } | null>(null)
  const [lassoEnd, setLassoEnd] = useState<{ sx: number; sy: number } | null>(null)

  // Right-click context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)


  // Dimension input ref for iPad focus
  const dimInputRef = useRef<HTMLInputElement>(null)

  // Over-constrained warning
  const [overConstrainedWallId, setOverConstrainedWallId] = useState<string | null>(null)

  // Editable dimension — wallId based, position computed dynamically
  const [editingDimWallId, setEditingDimWallId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const toScreen = useCallback((wx: number, wy: number): [number, number] => {
    return [wx * scale + panX, wy * scale + panY]
  }, [scale, panX, panY])

  const toWorld = useCallback((sx: number, sy: number): [number, number] => {
    return [(sx - panX) / scale, (sy - panY) / scale]
  }, [scale, panX, panY])

  // Snap to existing wall endpoints — ALWAYS prefers endpoints over grid
  // Uses BOTH screen-space AND world-space threshold (whichever is larger)
  const snapToEndpoint = useCallback((wx: number, wy: number): Point2D & { snapped?: boolean } => {
    // At any zoom: at least 500mm OR 60 screen pixels (whichever gives more range)
    const threshold = Math.max(SNAP_WORLD, SNAP_RADIUS_PX / scale)
    let bestDist = threshold
    let result: Point2D & { snapped?: boolean } = { x: snap(wx), y: snap(wy), snapped: false }

    for (const w of walls) {
      for (const pt of [w.start, w.end]) {
        const d = Math.sqrt((wx - pt.x) ** 2 + (wy - pt.y) ** 2)
        if (d < bestDist) {
          bestDist = d
          result = { x: pt.x, y: pt.y, snapped: true }
        }
      }
    }
    return result
  }, [walls, scale])

  // Compute dimension label position for a wall (in screen coords)
  const getDimScreenPos = useCallback((w: Wall): { sx: number; sy: number; ex: number; ey: number; labelX: number; labelY: number; length: number } | null => {
    const [sx, sy] = toScreen(w.start.x, w.start.y)
    const [ex, ey] = toScreen(w.end.x, w.end.y)
    const dx = ex - sx
    const dy = ey - sy
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len < 30) return null

    const ux = dx / len
    const uy = dy / len
    const nx = -uy
    const ny = ux

    // Room center for inward direction
    let roomCX = 0, roomCY = 0
    walls.forEach(ww => {
      const [a, b] = toScreen(ww.start.x, ww.start.y)
      roomCX += a; roomCY += b
    })
    if (walls.length > 0) { roomCX /= walls.length; roomCY /= walls.length }

    const midX = (sx + ex) / 2
    const midY = (sy + ey) / 2
    const testX = midX + nx * 10
    const testY = midY + ny * 10
    const distToCenter = Math.sqrt((testX - roomCX) ** 2 + (testY - roomCY) ** 2)
    const origDist = Math.sqrt((midX - roomCX) ** 2 + (midY - roomCY) ** 2)
    const inDir = distToCenter < origDist ? 1 : -1

    const dimOffset = 22
    const d1x = sx + nx * inDir * dimOffset
    const d1y = sy + ny * inDir * dimOffset
    const d2x = ex + nx * inDir * dimOffset
    const d2y = ey + ny * inDir * dimOffset

    const labelX = (d1x + d2x) / 2
    const labelY = (d1y + d2y) / 2

    const wLen = wallLength(w)
    const interiorLen = Math.round(wLen)

    return { sx: d1x, sy: d1y, ex: d2x, ey: d2y, labelX, labelY, length: interiorLen }
  }, [walls, toScreen])

  // Returns screen-space center {x, y} of the constraint glyph for a wall, or null
  const getConstraintGlyphPos = useCallback((w: Wall): { x: number; y: number } | null => {
    if (!w.constraint) return null
    const [sx, sy] = toScreen(w.start.x, w.start.y)
    const [ex, ey] = toScreen(w.end.x, w.end.y)
    const dx = ex - sx
    const dy = ey - sy
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len < 20) return null
    const midX = (sx + ex) / 2
    const midY = (sy + ey) / 2
    const nx = -dy / len
    const ny = dx / len
    return { x: midX + nx * 16, y: midY + ny * 16 }
  }, [toScreen])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (editingDimWallId) {
        if (e.key === 'Escape') setEditingDimWallId(null)
        return
      }
      if (e.key === 'Escape') {
        setDrawStart(null)
        setRectStart(null)
        setConstraintFirstWallId(null)
        setCoincidentFirst(null)
        setSelectedConstraintWallId(null)

        setContextMenu(null)
        setSketchTool('select')
        return
      }
      // Delete key: remove constraint from selected/hovered glyph
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
        const constraintTarget = selectedConstraintWallId || hoveredConstraintWallId
        if (constraintTarget) {
          e.preventDefault()
          useRoomStore.getState().pushHistory()
          useRoomStore.getState().updateWall(constraintTarget, { constraint: null })
          setSelectedConstraintWallId(null)
          setHoveredConstraintWallId(null)
          return
        }
      }
      // Undo / Redo (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          useRoomStore.getState().redo()
        } else {
          useRoomStore.getState().undo()
        }
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        useRoomStore.getState().redo()
        return
      }
      // Tool shortcuts (Fusion 360 style)
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (e.key === ' ') {
        e.preventDefault()
        setCoincidentFirst(null)
        setConstraintFirstWallId(null)
        setSketchTool('select')
        return
      }
      switch (e.key.toLowerCase()) {
        case 'l': setSketchTool('line'); break
        case 'r': setSketchTool('rectangle'); break
        case 'd': setSketchTool('dimension'); break
        case 'o': setSketchTool('door'); break
        case 'n': setSketchTool('window'); break
        case 'p': setSketchTool('column'); break
        case 'x': setSketchTool('construction'); break
        case 't': setSketchTool('trim'); break
        case 'f': setSketchTool('offset'); break
        case 'g': setSketchTool('fillet'); break
        case 'm': setSketchTool('mirror'); break
        case 'h': setSketchTool('hv'); break
        case 'q': setSketchTool('perpendicular'); break
        case 'e': setSketchTool('equal'); break
        case 'k': setSketchTool('fix'); break
        case 'j': setSketchTool('coincident'); break
        case 's': setSketchTool('symmetric'); break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [editingDimWallId, setSketchTool, selectedConstraintWallId, hoveredConstraintWallId])

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)
    const W = rect.width
    const H = rect.height

    // White background — clean architectural drawing style
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, W, H)

    const [ox, oy] = toScreen(0, 0)

    // --- Fill interior black when walls form closed polygon ---
    if (walls.length >= 3) {
      const EPS_CLOSE = 10
      const firstStart = walls[0].start
      const lastEnd = walls[walls.length - 1].end
      const isClosed = Math.abs(firstStart.x - lastEnd.x) < EPS_CLOSE && Math.abs(firstStart.y - lastEnd.y) < EPS_CLOSE

      if (isClosed) {
        ctx.fillStyle = '#000000'
        ctx.beginPath()
        walls.forEach((w, i) => {
          const [sx, sy] = toScreen(w.start.x, w.start.y)
          if (i === 0) ctx.moveTo(sx, sy)
          else ctx.lineTo(sx, sy)
        })
        ctx.closePath()
        ctx.fill()
      }
    }

    // --- Draw sketch lines (walls as thin lines — Fusion 360 style) ---
    walls.forEach(w => {
      const [sx, sy] = toScreen(w.start.x, w.start.y)
      const [ex, ey] = toScreen(w.end.x, w.end.y)
      const isSelected = w.id === selectedWallId
      const isHovered = w.id === hoverWallId
      const isEditing = w.id === editingDimWallId
      const isTrimHover = sketchTool === 'trim' && isHovered

      // Determine constraint state for color
      const isConstrained = !!(w.constraint)
      // Wall line colors on white background
      if (isTrimHover) {
        ctx.strokeStyle = '#ff0000'
        ctx.lineWidth = 3
      } else if (isEditing) {
        ctx.strokeStyle = '#0066cc'
        ctx.lineWidth = 2.5
      } else if (isSelected) {
        ctx.strokeStyle = '#0055aa'
        ctx.lineWidth = 2.5
      } else if (isHovered) {
        ctx.strokeStyle = '#3388cc'
        ctx.lineWidth = 2
      } else if (isConstrained) {
        ctx.strokeStyle = '#222222'
        ctx.lineWidth = 1.5
      } else {
        ctx.strokeStyle = '#555555'
        ctx.lineWidth = 1.5
      }

      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(ex, ey)
      ctx.stroke()

      // Openings visualization
      const dx = ex - sx
      const dy = ey - sy
      const len = Math.sqrt(dx * dx + dy * dy)
      if (len < 1) return
      const ux = dx / len
      const uy = dy / len
      const nx = -uy
      const ny = ux
      const thick = w.thickness * scale

      w.openings.forEach(op => {
        const wLen = wallLength(w)
        const t = op.offsetFromStart / wLen
        const t2 = (op.offsetFromStart + op.width) / wLen
        const ox1 = sx + dx * t
        const oy1 = sy + dy * t
        const ox2 = sx + dx * t2
        const oy2 = sy + dy * t2
        const halfT = Math.max(3, (w.thickness / 2) * scale)

        if (op.type === 'door') {
          // Clear the wall gap (white rectangle over the wall)
          ctx.fillStyle = '#ffffff'
          ctx.beginPath()
          ctx.moveTo(ox1 + nx * halfT, oy1 + ny * halfT)
          ctx.lineTo(ox2 + nx * halfT, oy2 + ny * halfT)
          ctx.lineTo(ox2 - nx * halfT, oy2 - ny * halfT)
          ctx.lineTo(ox1 - nx * halfT, oy1 - ny * halfT)
          ctx.closePath()
          ctx.fill()

          // Door properties
          const hingeAtStart = (op.hingePosition || 'start') === 'start'
          const swingSign = (op.swingSide || 'inside') === 'inside' ? 1 : -1

          // Hinge and free points
          const hx = hingeAtStart ? ox1 : ox2
          const hy = hingeAtStart ? oy1 : oy2
          const fx = hingeAtStart ? ox2 : ox1
          const fy = hingeAtStart ? oy2 : oy1

          // Door screen width (radius of arc)
          const doorR = Math.sqrt((ox2 - ox1) ** 2 + (oy2 - oy1) ** 2)

          // Perpendicular direction from hinge (the open door leaf position)
          const leafX = hx + nx * swingSign * doorR
          const leafY = hy + ny * swingSign * doorR

          // Door leaf line (straight line from hinge to leaf end)
          ctx.strokeStyle = '#333333'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(hx, hy)
          ctx.lineTo(leafX, leafY)
          ctx.stroke()

          // Door swing arc (quarter circle from leaf to wall opening)
          const leafAngle = Math.atan2(leafY - hy, leafX - hx)
          const freeAngle = Math.atan2(fy - hy, fx - hx)
          ctx.strokeStyle = '#999999'
          ctx.lineWidth = 0.8
          ctx.setLineDash([3, 3])
          ctx.beginPath()
          // Determine arc direction: sweep from leaf to free point
          // Check if going counterclockwise is shorter
          let diff = freeAngle - leafAngle
          while (diff > Math.PI) diff -= 2 * Math.PI
          while (diff < -Math.PI) diff += 2 * Math.PI
          const ccw = diff < 0
          ctx.arc(hx, hy, doorR, leafAngle, freeAngle, ccw)
          ctx.stroke()
          ctx.setLineDash([])

          // Hinge dot indicator
          ctx.fillStyle = '#333333'
          ctx.beginPath()
          ctx.arc(hx, hy, 3, 0, Math.PI * 2)
          ctx.fill()
        } else {
          // Window — architectural floor plan style
          // Clear wall gap
          ctx.fillStyle = '#ffffff'
          ctx.beginPath()
          ctx.moveTo(ox1 + nx * halfT, oy1 + ny * halfT)
          ctx.lineTo(ox2 + nx * halfT, oy2 + ny * halfT)
          ctx.lineTo(ox2 - nx * halfT, oy2 - ny * halfT)
          ctx.lineTo(ox1 - nx * halfT, oy1 - ny * halfT)
          ctx.closePath()
          ctx.fill()

          // Window symbol: three parallel lines
          const lineOff = halfT * 0.6
          ctx.strokeStyle = '#333333'
          ctx.lineWidth = 1.5
          // Outer lines
          ctx.beginPath()
          ctx.moveTo(ox1 + nx * lineOff, oy1 + ny * lineOff)
          ctx.lineTo(ox2 + nx * lineOff, oy2 + ny * lineOff)
          ctx.stroke()
          ctx.beginPath()
          ctx.moveTo(ox1 - nx * lineOff, oy1 - ny * lineOff)
          ctx.lineTo(ox2 - nx * lineOff, oy2 - ny * lineOff)
          ctx.stroke()
          // Center line (glass)
          ctx.strokeStyle = '#0066cc'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(ox1, oy1)
          ctx.lineTo(ox2, oy2)
          ctx.stroke()
        }

        // Opening width label (small, centered on opening)
        const omx = (ox1 + ox2) / 2
        const omy = (oy1 + oy2) / 2
        const labelOff = halfT + 10
        const lx = omx - nx * labelOff
        const ly = omy - ny * labelOff
        ctx.font = '10px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const wLabel = `${Math.round(op.width)}`
        const tw = ctx.measureText(wLabel).width
        ctx.fillStyle = '#ffffffcc'
        ctx.fillRect(lx - tw / 2 - 2, ly - 6, tw + 4, 12)
        ctx.fillStyle = op.type === 'door' ? '#8B4513' : '#0066cc'
        ctx.fillText(wLabel, lx, ly)
      })

      // Endpoint dots — show connected (green) vs open (gray/blue)
      const EPS_DRAW = 5 // 5mm tolerance for connected check
      for (const [px, py, pt] of [[sx, sy, w.start], [ex, ey, w.end]] as const) {
        // Check if this endpoint is shared with another wall
        let isConnected = false
        for (const other of walls) {
          if (other.id === w.id) continue
          if ((Math.abs(other.start.x - pt.x) < EPS_DRAW && Math.abs(other.start.y - pt.y) < EPS_DRAW) ||
              (Math.abs(other.end.x - pt.x) < EPS_DRAW && Math.abs(other.end.y - pt.y) < EPS_DRAW)) {
            isConnected = true
            break
          }
        }
        const dotR = isSelected || isHovered ? 5 : 3.5
        if (isConnected) {
          ctx.fillStyle = '#009944'
          ctx.beginPath()
          ctx.arc(px, py, dotR, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.fillStyle = isSelected ? '#0055aa' : isHovered ? '#3388cc' : '#888888'
          ctx.beginPath()
          ctx.arc(px, py, dotR, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#ffffff'
          ctx.beginPath()
          ctx.arc(px, py, dotR - 2, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // --- Constraint glyph (H/V) — Fusion 360 style, clickable ---
      if (w.constraint) {
        const wdx = ex - sx
        const wdy = ey - sy
        const wlen = Math.sqrt(wdx * wdx + wdy * wdy)
        if (wlen > 20) {
          const midX = (sx + ex) / 2
          const midY = (sy + ey) / 2
          const wnx = -wdy / wlen
          const wny = wdx / wlen
          const iconX = midX + wnx * 16
          const iconY = midY + wny * 16

          const isGlyphHovered = hoveredConstraintWallId === w.id
          const isGlyphSelected = selectedConstraintWallId === w.id
          const boxSize = 14

          // Background box
          ctx.fillStyle = (isGlyphSelected || isGlyphHovered) ? '#ffffffee' : '#ffffffcc'
          ctx.strokeStyle = w.constraint === 'H' ? '#cc0000' : '#008800'
          ctx.lineWidth = (isGlyphSelected || isGlyphHovered) ? 2 : 1.5
          ctx.beginPath()
          ctx.roundRect(iconX - boxSize / 2, iconY - boxSize / 2, boxSize, boxSize, 3)
          ctx.fill()
          ctx.stroke()

          // H or V letter
          ctx.fillStyle = w.constraint === 'H' ? '#cc0000' : '#008800'
          ctx.font = 'bold 10px sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(w.constraint, iconX, iconY)

          // Small "×" delete hint when hovered
          if (isGlyphHovered || isGlyphSelected) {
            ctx.fillStyle = '#ffffff99'
            ctx.font = '7px sans-serif'
            ctx.textAlign = 'left'
            ctx.textBaseline = 'top'
            ctx.fillText('Del', iconX + boxSize / 2 + 2, iconY - 5)
          }
        }
      }

      // --- Show dimension: only dimensioned walls + selected + dimension tool ---
      const isDimensioned = !!w.dimensionValue
      const showDim = isDimensioned || isSelected || isEditing || sketchTool === 'dimension'
      // Non-dimensioned walls: only show when selected or editing (not in dimension tool list)
      const showDimLine = isDimensioned || isSelected || isEditing
      if (showDim) {
        const dimInfo = getDimScreenPos(w)
        if (dimInfo) {
          const { sx: d1x, sy: d1y, ex: d2x, ey: d2y, labelX, labelY, length } = dimInfo
          const dimFontSize = Math.max(10, Math.min(14, 12 / Math.sqrt(scale / 0.15)))

          // Color scheme: dimensioned = green (like Fusion 360), selected = cyan
          const dimColor = isDimensioned ? '#008800' : '#0066cc'
          const dimColorAlpha = isDimensioned ? '#00880088' : '#0066cc88'

          if (!showDimLine && !isSelected) {
            // Skip dimension lines/arrows — only show clickable label for dimension tool
          } else {
          // Dimension line
          ctx.strokeStyle = dimColorAlpha
          ctx.lineWidth = 0.8
          ctx.beginPath()
          ctx.moveTo(d1x, d1y)
          ctx.lineTo(d2x, d2y)
          ctx.stroke()

          // Extension lines
          ctx.strokeStyle = isDimensioned ? '#44cc4444' : '#88888844'
          ctx.lineWidth = 0.5
          const extDir = d1y > sy ? 1 : -1
          ctx.beginPath()
          ctx.moveTo(toScreen(w.start.x, w.start.y)[0], toScreen(w.start.x, w.start.y)[1])
          ctx.lineTo(d1x, d1y)
          ctx.stroke()
          ctx.beginPath()
          ctx.moveTo(toScreen(w.end.x, w.end.y)[0], toScreen(w.end.x, w.end.y)[1])
          ctx.lineTo(d2x, d2y)
          ctx.stroke()

          // Arrowheads (Fusion 360 style)
          const adx = d2x - d1x
          const ady = d2y - d1y
          const alen = Math.sqrt(adx * adx + ady * ady)
          if (alen > 20) {
            const aux = adx / alen
            const auy = ady / alen
            const arrowLen = 6
            const arrowW = 3
            ctx.fillStyle = dimColor
            // Left arrow
            ctx.beginPath()
            ctx.moveTo(d1x, d1y)
            ctx.lineTo(d1x + aux * arrowLen + auy * arrowW, d1y + auy * arrowLen - aux * arrowW)
            ctx.lineTo(d1x + aux * arrowLen - auy * arrowW, d1y + auy * arrowLen + aux * arrowW)
            ctx.closePath()
            ctx.fill()
            // Right arrow
            ctx.beginPath()
            ctx.moveTo(d2x, d2y)
            ctx.lineTo(d2x - aux * arrowLen + auy * arrowW, d2y - auy * arrowLen - aux * arrowW)
            ctx.lineTo(d2x - aux * arrowLen - auy * arrowW, d2y - auy * arrowLen + aux * arrowW)
            ctx.closePath()
            ctx.fill()
          }
          } // end showDimLine

          // Dimension label (Fusion 360 style)
          if (!isEditing && (isDimensioned || isSelected || sketchTool === 'dimension')) {
            const label = `${length}`
            ctx.font = `${isDimensioned ? 'bold' : ''} ${dimFontSize}px sans-serif`
            const metrics = ctx.measureText(label)
            const padX = 6
            const padY = 3
            const boxW = metrics.width + padX * 2
            const boxH = dimFontSize + padY * 2 + 2
            const bx = labelX - boxW / 2
            const by = labelY - boxH / 2

            // Box background
            ctx.fillStyle = '#ffffffee'
            ctx.strokeStyle = isDimensioned ? '#00880088' : '#0066cc88'
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.roundRect(bx, by, boxW, boxH, 3)
            ctx.fill()
            ctx.stroke()

            // Label text — green if dimensioned, cyan otherwise
            ctx.fillStyle = isDimensioned ? '#008800' : '#0066cc'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(label, labelX, labelY)
          }
        }
      }
    })

    // --- Draw columns ---
    columns.forEach(col => {
      const [cx, cy] = toScreen(col.position.x, col.position.y)
      const cw = col.width * scale
      const cd = col.depth * scale

      ctx.fillStyle = '#55556688'
      ctx.fillRect(cx - cw / 2, cy - cd / 2, cw, cd)
      ctx.strokeStyle = '#aaaacc'
      ctx.lineWidth = 1.5
      ctx.strokeRect(cx - cw / 2, cy - cd / 2, cw, cd)

      // Cross hatch
      ctx.strokeStyle = '#777799'
      ctx.lineWidth = 0.8
      ctx.beginPath()
      ctx.moveTo(cx - cw / 2, cy - cd / 2)
      ctx.lineTo(cx + cw / 2, cy + cd / 2)
      ctx.moveTo(cx + cw / 2, cy - cd / 2)
      ctx.lineTo(cx - cw / 2, cy + cd / 2)
      ctx.stroke()

      if (col.label) {
        ctx.fillStyle = '#aaaacc'
        ctx.font = '9px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillText(col.label, cx, cy + cd / 2 + 3)
      }
    })

    // --- Draw construction/guide lines ---
    guides.forEach(g => {
      const [sx, sy] = toScreen(g.start.x, g.start.y)
      const [ex, ey] = toScreen(g.end.x, g.end.y)
      ctx.strokeStyle = '#ff8800'
      ctx.lineWidth = 1
      ctx.setLineDash([6, 4])
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(ex, ey)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = '#ff8800'
      ctx.beginPath(); ctx.arc(sx, sy, 2.5, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(ex, ey, 2.5, 0, Math.PI * 2); ctx.fill()
    })

    // --- Draw construction line preview ---
    if (drawStart && sketchTool === 'construction') {
      const [sx, sy] = toScreen(drawStart.x, drawStart.y)
      const snapped = snapToEndpoint(mouseWorld.x, mouseWorld.y)
      const [ex, ey] = toScreen(snapped.x, snapped.y)
      ctx.strokeStyle = '#ff880088'
      ctx.lineWidth = 1.5
      ctx.setLineDash([6, 4])
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(ex, ey)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = '#ff8800'
      ctx.beginPath(); ctx.arc(sx, sy, 4, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(ex, ey, 4, 0, Math.PI * 2); ctx.fill()
    }

    // --- Area & Perimeter (when room is closed) ---
    if (walls.length >= 3) {
      let area = 0
      let perimeter = 0
      const pts: [number, number][] = []
      walls.forEach(w => {
        pts.push([w.start.x, w.start.y])
        perimeter += wallLength(w)
      })
      for (let i = 0; i < pts.length; i++) {
        const j = (i + 1) % pts.length
        area += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1]
      }
      area = Math.abs(area) / 2
      const sqm = (area / 1_000_000).toFixed(2)

      let roomCX = 0, roomCY = 0
      walls.forEach(ww => {
        const [a, b] = toScreen(ww.start.x, ww.start.y)
        roomCX += a; roomCY += b
      })
      if (walls.length > 0) { roomCX /= walls.length; roomCY /= walls.length }

      const dimFontSize = Math.max(10, Math.min(14, 12 / Math.sqrt(scale / 0.15)))
      ctx.font = `bold ${dimFontSize + 2}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#00000022'
      ctx.fillText(`${sqm} m\u00B2`, roomCX, roomCY - 8)
      ctx.font = `${dimFontSize - 1}px sans-serif`
      ctx.fillStyle = '#00000018'
      ctx.fillText(`${Math.round(perimeter)} mm`, roomCX, roomCY + 10)
    }

    // --- Draw line preview (while drawing — Fusion 360 style) ---
    if (drawStart && sketchTool === 'line') {
      const [sx, sy] = toScreen(drawStart.x, drawStart.y)
      const snapped = snapToEndpoint(mouseWorld.x, mouseWorld.y)
      const [ex, ey] = toScreen(snapped.x, snapped.y)

      // Preview line
      ctx.strokeStyle = '#0055aa'
      ctx.lineWidth = 2
      ctx.setLineDash([6, 4])
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(ex, ey)
      ctx.stroke()
      ctx.setLineDash([])

      // Live dimension (Fusion 360: shows length while drawing)
      const pdx = snapped.x - drawStart.x
      const pdy = snapped.y - drawStart.y
      const pLen = Math.round(Math.sqrt(pdx * pdx + pdy * pdy))
      if (pLen > 50) {
        const pmx = (sx + ex) / 2
        const pmy = (sy + ey) / 2

        // Offset label perpendicular to line
        const pldx = ex - sx
        const pldy = ey - sy
        const pllen = Math.sqrt(pldx * pldx + pldy * pldy)
        const pnx = -pldy / pllen
        const pny = pldx / pllen
        const labelOff = 18
        const lx = pmx + pnx * labelOff
        const ly = pmy + pny * labelOff

        const label = `${pLen} mm`
        ctx.font = 'bold 12px sans-serif'
        const pm = ctx.measureText(label)
        const boxW = pm.width + 16
        const boxH = 22

        // Dark bg box (Fusion 360 style)
        ctx.fillStyle = '#ffffffee'
        ctx.strokeStyle = '#0055aa88'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.roundRect(lx - boxW / 2, ly - boxH / 2, boxW, boxH, 3)
        ctx.fill()
        ctx.stroke()

        ctx.fillStyle = '#0066cc'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(label, lx, ly)
      }

      // Start/end points
      ctx.fillStyle = '#0055aa'
      ctx.beginPath(); ctx.arc(sx, sy, 4, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#009944'
      ctx.beginPath(); ctx.arc(ex, ey, 4, 0, Math.PI * 2); ctx.fill()
    }

    // --- Draw rectangle preview ---
    if (rectStart && sketchTool === 'rectangle') {
      const snapped = snapToEndpoint(mouseWorld.x, mouseWorld.y)
      const [x1, y1] = toScreen(rectStart.x, rectStart.y)
      const [x2, y2] = toScreen(snapped.x, snapped.y)

      ctx.strokeStyle = '#0055aa'
      ctx.lineWidth = 2
      ctx.setLineDash([6, 4])
      ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1))
      ctx.setLineDash([])

      // Size labels
      const rw = Math.abs(snapped.x - rectStart.x)
      const rh = Math.abs(snapped.y - rectStart.y)
      ctx.fillStyle = '#0066cc'
      ctx.font = 'bold 11px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(`${Math.round(rw)}`, (x1 + x2) / 2, Math.min(y1, y2) - 12)
      ctx.fillText(`${Math.round(rh)}`, Math.max(x1, x2) + 24, (y1 + y2) / 2)
    }

    // --- Snap indicator (green ring when near an existing endpoint) ---
    if (sketchTool === 'line' || sketchTool === 'rectangle' || sketchTool === 'construction' || sketchTool === 'column') {
      const snapResult = snapToEndpoint(mouseWorld.x, mouseWorld.y)
      if (snapResult.snapped) {
        const [snapSx, snapSy] = toScreen(snapResult.x, snapResult.y)
        // Outer green ring
        ctx.strokeStyle = '#009944'
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.arc(snapSx, snapSy, 10, 0, Math.PI * 2)
        ctx.stroke()
        // Inner green dot
        ctx.fillStyle = '#009944'
        ctx.beginPath()
        ctx.arc(snapSx, snapSy, 3, 0, Math.PI * 2)
        ctx.fill()
        // Label
        ctx.fillStyle = '#009944'
        ctx.font = 'bold 9px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('SNAP', snapSx, snapSy - 15)
      }
    }

    // --- Column placement preview ---
    if (sketchTool === 'column' && !dragTarget) {
      const snapped = snapToEndpoint(mouseWorld.x, mouseWorld.y)
      const [cx, cy] = toScreen(snapped.x, snapped.y)
      const cw = 300 * scale
      const cd = 300 * scale
      ctx.strokeStyle = '#aa88ff88'
      ctx.lineWidth = 1.5
      ctx.setLineDash([4, 3])
      ctx.strokeRect(cx - cw / 2, cy - cd / 2, cw, cd)
      ctx.setLineDash([])
    }

    // --- Door/Window placement preview (ghost following mouse on wall) ---
    if ((sketchTool === 'door' || sketchTool === 'window') && !useUIStore.getState().showOpeningDialog) {
      const preset = useUIStore.getState().openingPreset
      if (preset) {
        // Find nearest wall to mouse
        const hitPreview = findWallAt(
          mouseWorld.x * scale + panX,
          mouseWorld.y * scale + panY
        )
        if (hitPreview) {
          const w = walls.find(ww => ww.id === hitPreview.wallId)
          if (w) {
            const [wsx, wsy] = toScreen(w.start.x, w.start.y)
            const [wex, wey] = toScreen(w.end.x, w.end.y)
            const wdx = wex - wsx, wdy = wey - wsy
            const wlen = Math.sqrt(wdx * wdx + wdy * wdy)
            const wLen = wallLength(w)
            if (wlen > 1 && wLen > 1) {
              const wnx = -wdy / wlen, wny = wdx / wlen
              const halfT = Math.max(3, (w.thickness / 2) * scale)

              // Project mouse onto wall
              const mwdx = w.end.x - w.start.x, mwdy = w.end.y - w.start.y
              const mt = ((mouseWorld.x - w.start.x) * mwdx + (mouseWorld.y - w.start.y) * mwdy) / (mwdx * mwdx + mwdy * mwdy)
              let offset = Math.max(0, Math.min(1, mt)) * wLen - preset.width / 2
              offset = Math.max(0, Math.min(wLen - preset.width, offset))
              offset = Math.round(offset / 50) * 50

              const t1 = offset / wLen
              const t2 = (offset + preset.width) / wLen
              const p1x = wsx + wdx * t1, p1y = wsy + wdy * t1
              const p2x = wsx + wdx * t2, p2y = wsy + wdy * t2

              // Ghost rectangle (dashed)
              ctx.strokeStyle = sketchTool === 'door' ? '#8B4513' : '#0066cc'
              ctx.lineWidth = 1.5
              ctx.setLineDash([4, 4])
              ctx.fillStyle = sketchTool === 'door' ? 'rgba(139,69,19,0.08)' : 'rgba(0,102,204,0.08)'
              ctx.beginPath()
              ctx.moveTo(p1x + wnx * halfT, p1y + wny * halfT)
              ctx.lineTo(p2x + wnx * halfT, p2y + wny * halfT)
              ctx.lineTo(p2x - wnx * halfT, p2y - wny * halfT)
              ctx.lineTo(p1x - wnx * halfT, p1y - wny * halfT)
              ctx.closePath()
              ctx.fill()
              ctx.stroke()
              ctx.setLineDash([])

              // Width label
              const pmx = (p1x + p2x) / 2, pmy = (p1y + p2y) / 2
              const labelOff = halfT + 12
              ctx.font = 'bold 10px sans-serif'
              ctx.textAlign = 'center'
              ctx.textBaseline = 'middle'
              const pwLabel = `${preset.width}`
              const ptw = ctx.measureText(pwLabel).width
              const lbx = pmx - wnx * labelOff
              const lby = pmy - wny * labelOff
              ctx.fillStyle = '#ffffffcc'
              ctx.fillRect(lbx - ptw / 2 - 3, lby - 7, ptw + 6, 14)
              ctx.fillStyle = sketchTool === 'door' ? '#8B4513' : '#0066cc'
              ctx.fillText(pwLabel, lbx, lby)
            }
          }
        }
      }
    }

    // Draw placed items (top-down)
    items.forEach(item => {
      const catItem = catalogItems.find(c => c.id === item.catalogItemId)
      if (!catItem) return
      const [ix, iy] = toScreen(item.position.x, item.position.z)
      const iw = catItem.width * scale
      const id = catItem.depth * scale
      ctx.save()
      ctx.translate(ix, iy)
      ctx.rotate(item.rotation)
      ctx.fillStyle = catItem.category === 'base-cabinet' ? 'rgba(80, 120, 160, 0.4)' :
        catItem.category === 'wall-cabinet' ? 'rgba(60, 110, 150, 0.3)' :
        catItem.category === 'countertop' ? 'rgba(100, 100, 120, 0.4)' :
        catItem.category === 'sink' ? 'rgba(80, 140, 180, 0.4)' :
        'rgba(100, 100, 120, 0.4)'
      ctx.fillRect(-iw / 2, -id / 2, iw, id)
      ctx.strokeStyle = '#999999'
      ctx.lineWidth = 1
      ctx.strokeRect(-iw / 2, -id / 2, iw, id)
      ctx.fillStyle = '#ccccdd'
      ctx.font = `${Math.max(8, Math.min(11, iw * 0.15))}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const name = catItem.nameTH.length > 10 ? catItem.nameTH.substring(0, 8) + '..' : catItem.nameTH
      ctx.fillText(name, 0, 0)
      ctx.restore()
    })

    // Scale bar
    const scaleBarMM = scale > 1 ? 100 : scale > 0.5 ? 200 : scale > 0.2 ? 500 : scale > 0.1 ? 1000 : scale > 0.05 ? 2000 : 5000
    const scaleBarPx = scaleBarMM * scale
    const sbX = W - 20 - scaleBarPx
    const sbY = H - 20
    ctx.strokeStyle = '#999999'
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(sbX, sbY); ctx.lineTo(sbX + scaleBarPx, sbY); ctx.stroke()
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(sbX, sbY - 5); ctx.lineTo(sbX, sbY + 5); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(sbX + scaleBarPx, sbY - 5); ctx.lineTo(sbX + scaleBarPx, sbY + 5); ctx.stroke()
    ctx.fillStyle = '#666666'
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`${scaleBarMM} mm`, sbX + scaleBarPx / 2, sbY - 10)

    // Coordinate display
    ctx.fillStyle = '#666666'
    ctx.font = '10px monospace'
    ctx.textAlign = 'left'
    ctx.fillText(`X: ${Math.round(mouseWorld.x)}  Y: ${Math.round(mouseWorld.y)} mm`, 10, H - 10)

    // Leica DISTO status (bottom-right when connected)
    if (distoHook?.status === 'connected') {
      ctx.textAlign = 'right'
      ctx.fillStyle = '#10b981'
      ctx.font = 'bold 10px monospace'
      ctx.fillText(`\u25CF ${distoHook.deviceName || 'DISTO'} connected`, W - 10, H - 24)
      if (distoHook.lastMeasurement) {
        ctx.fillStyle = '#0066cc'
        ctx.font = 'bold 12px monospace'
        ctx.fillText(`\u21A6 ${distoHook.lastMeasurement} mm`, W - 10, H - 10)
      }
    }

    // --- Lasso selection rectangle ---
    if (lassoStart && lassoEnd) {
      const lx = Math.min(lassoStart.sx, lassoEnd.sx)
      const ly = Math.min(lassoStart.sy, lassoEnd.sy)
      const lw = Math.abs(lassoEnd.sx - lassoStart.sx)
      const lh = Math.abs(lassoEnd.sy - lassoStart.sy)
      ctx.strokeStyle = '#009944'
      ctx.lineWidth = 1.5
      ctx.setLineDash([6, 4])
      ctx.strokeRect(lx, ly, lw, lh)
      ctx.fillStyle = 'rgba(0,255,136,0.08)'
      ctx.fillRect(lx, ly, lw, lh)
      ctx.setLineDash([])

      // Highlight endpoints inside lasso
      const x1w = Math.min(...[lassoStart, lassoEnd].map(p => toWorld(p.sx, p.sy)[0]))
      const y1w = Math.min(...[lassoStart, lassoEnd].map(p => toWorld(p.sx, p.sy)[1]))
      const x2w = Math.max(...[lassoStart, lassoEnd].map(p => toWorld(p.sx, p.sy)[0]))
      const y2w = Math.max(...[lassoStart, lassoEnd].map(p => toWorld(p.sx, p.sy)[1]))
      let insideCount = 0
      walls.forEach(w => {
        for (const pt of [w.start, w.end]) {
          if (pt.x >= x1w && pt.x <= x2w && pt.y >= y1w && pt.y <= y2w) {
            const [px, py] = toScreen(pt.x, pt.y)
            ctx.beginPath()
            ctx.arc(px, py, 6, 0, Math.PI * 2)
            ctx.fillStyle = '#009944'
            ctx.fill()
            insideCount++
          }
        }
      })
      if (insideCount >= 2) {
        ctx.fillStyle = '#009944'
        ctx.font = 'bold 11px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(`Join ${insideCount} points`, (lassoStart.sx + lassoEnd.sx) / 2, Math.min(lassoStart.sy, lassoEnd.sy) - 6)
      }
    }

    // --- Coincident tool: highlight all endpoints when tool is active ---
    if (sketchTool === 'coincident') {
      walls.forEach(w => {
        for (const [pt, part] of [[w.start, 'start'], [w.end, 'end']] as const) {
          const [px, py] = toScreen(pt.x, pt.y)
          // Highlight the first selected point with a pulsing ring
          if (coincidentFirst && coincidentFirst.wallId === w.id && coincidentFirst.part === part) {
            ctx.strokeStyle = '#cc8800'
            ctx.lineWidth = 2.5
            ctx.beginPath()
            ctx.arc(px, py, 10, 0, Math.PI * 2)
            ctx.stroke()
            ctx.fillStyle = '#cc8800'
            ctx.beginPath()
            ctx.arc(px, py, 4, 0, Math.PI * 2)
            ctx.fill()
          } else {
            // Show all endpoints as hollow circles (targets)
            ctx.strokeStyle = '#ffcc0088'
            ctx.lineWidth = 1.5
            ctx.beginPath()
            ctx.arc(px, py, 7, 0, Math.PI * 2)
            ctx.stroke()
          }
        }
      })
      // Show "Select 1st point" or "Select 2nd point" hint
      ctx.fillStyle = '#cc8800'
      ctx.font = 'bold 12px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(coincidentFirst ? '⬤ Select 2nd point to merge' : '○ Select 1st point', 10, H - 30)
    }

  }, [walls, columns, guides, items, panX, panY, scale, selectedWallId, hoverWallId, hoveredConstraintWallId, selectedConstraintWallId, toScreen, editingDimWallId, drawStart, rectStart, mouseWorld, sketchTool, snapToEndpoint, dragTarget, getDimScreenPos, canvasReady, distoHook, lassoStart, lassoEnd, coincidentFirst])

  // Force initial draw + resize observer
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    // Force initial draw after mount
    setCanvasReady(1)
    const ro = new ResizeObserver(() => { setCanvasReady(c => c + 1) })
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [])

  const getMousePos = (e: React.MouseEvent): [number, number] => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return [e.clientX - rect.left, e.clientY - rect.top]
  }

  // Find dimension label at mouse position — computed dynamically, no stored refs!
  const findDimAt = useCallback((mx: number, my: number): { wallId: string; length: number } | null => {
    for (const w of walls) {
      const isVisible = w.id === selectedWallId || w.id === editingDimWallId || sketchTool === 'dimension'
      if (!isVisible) continue

      const dimInfo = getDimScreenPos(w)
      if (!dimInfo) continue

      const { labelX, labelY, length } = dimInfo
      // Generous hit area — 50px wide, 20px tall
      if (Math.abs(mx - labelX) < 50 && Math.abs(my - labelY) < 20) {
        return { wallId: w.id, length }
      }
    }
    return null
  }, [walls, selectedWallId, editingDimWallId, sketchTool, getDimScreenPos])

  // Find constraint glyph at mouse position — returns wallId or null
  const findConstraintGlyphAt = useCallback((mx: number, my: number): string | null => {
    for (const w of walls) {
      if (!w.constraint) continue
      const pos = getConstraintGlyphPos(w)
      if (!pos) continue
      // Hit radius of 10px around the glyph center
      if (Math.sqrt((mx - pos.x) ** 2 + (my - pos.y) ** 2) < 10) {
        return w.id
      }
    }
    return null
  }, [walls, getConstraintGlyphPos])

  // Find opening at mouse position (for dragging openings along wall)
  const findOpeningAt = (mx: number, my: number): { wallId: string; openingId: string } | null => {
    for (const w of walls) {
      if (w.openings.length === 0) continue
      const [sx, sy] = toScreen(w.start.x, w.start.y)
      const [ex, ey] = toScreen(w.end.x, w.end.y)
      const ddx = ex - sx, ddy = ey - sy
      const wLen = wallLength(w)
      const len = Math.sqrt(ddx * ddx + ddy * ddy)
      if (len < 1) continue
      const nnx = -ddy / len, nny = ddx / len
      const halfT = Math.max(3, (w.thickness / 2) * scale)
      for (const op of w.openings) {
        const t1 = op.offsetFromStart / wLen
        const t2 = (op.offsetFromStart + op.width) / wLen
        const ox1 = sx + ddx * t1, oy1 = sy + ddy * t1
        const ox2 = sx + ddx * t2, oy2 = sy + ddy * t2
        // Check point-in-rectangle (opening area with thickness)
        const cx = (ox1 + ox2) / 2, cy = (oy1 + oy2) / 2
        const relX = (mx - cx) * (ddx / len) + (my - cy) * (ddy / len)
        const relY = (mx - cx) * nnx + (my - cy) * nny
        const halfW = Math.sqrt((ox2 - ox1) ** 2 + (oy2 - oy1) ** 2) / 2
        if (Math.abs(relX) < halfW + 4 && Math.abs(relY) < halfT + 4) {
          return { wallId: w.id, openingId: op.id }
        }
      }
    }
    return null
  }

  const findWallAt = (mx: number, my: number): { wallId: string; part: 'start' | 'end' | 'body'; t?: number } | null => {
    const hitR = 8
    for (const w of walls) {
      const [sx, sy] = toScreen(w.start.x, w.start.y)
      const [ex, ey] = toScreen(w.end.x, w.end.y)
      if (Math.sqrt((mx - sx) ** 2 + (my - sy) ** 2) < hitR) return { wallId: w.id, part: 'start' }
      if (Math.sqrt((mx - ex) ** 2 + (my - ey) ** 2) < hitR) return { wallId: w.id, part: 'end' }
      const dx = ex - sx
      const dy = ey - sy
      const len = Math.sqrt(dx * dx + dy * dy)
      if (len < 1) continue
      const t = Math.max(0, Math.min(1, ((mx - sx) * dx + (my - sy) * dy) / (len * len)))
      const px = sx + t * dx
      const py = sy + t * dy
      const dist = Math.sqrt((mx - px) ** 2 + (my - py) ** 2)
      // Use wall's actual screen thickness for hit detection (click anywhere on the black fill)
      const halfThick = Math.max(hitR, (w.thickness / 2) * scale + 2)
      if (dist < halfThick) return { wallId: w.id, part: 'body', t }
    }
    return null
  }

  // Find the closest endpoint near mouse position (for Coincident tool)
  const findEndpointAt = (mx: number, my: number): { wallId: string; part: 'start' | 'end'; point: Point2D } | null => {
    const hitR = 12 // generous hit radius for endpoints
    let best: { wallId: string; part: 'start' | 'end'; point: Point2D; dist: number } | null = null
    for (const w of walls) {
      const [sx, sy] = toScreen(w.start.x, w.start.y)
      const [ex, ey] = toScreen(w.end.x, w.end.y)
      const dStart = Math.sqrt((mx - sx) ** 2 + (my - sy) ** 2)
      const dEnd = Math.sqrt((mx - ex) ** 2 + (my - ey) ** 2)
      if (dStart < hitR && (!best || dStart < best.dist)) {
        best = { wallId: w.id, part: 'start', point: w.start, dist: dStart }
      }
      if (dEnd < hitR && (!best || dEnd < best.dist)) {
        best = { wallId: w.id, part: 'end', point: w.end, dist: dEnd }
      }
    }
    return best ? { wallId: best.wallId, part: best.part, point: best.point } : null
  }

  const findGuideAt = (mx: number, my: number): string | null => {
    for (const g of guides) {
      const [sx, sy] = toScreen(g.start.x, g.start.y)
      const [ex, ey] = toScreen(g.end.x, g.end.y)
      const dx = ex - sx
      const dy = ey - sy
      const len = Math.sqrt(dx * dx + dy * dy)
      if (len < 1) continue
      const t = Math.max(0, Math.min(1, ((mx - sx) * dx + (my - sy) * dy) / (len * len)))
      const px = sx + t * dx
      const py = sy + t * dy
      const dist = Math.sqrt((mx - px) ** 2 + (my - py) ** 2)
      if (dist < 6) return g.id
    }
    return null
  }

  const findColumnAt = (mx: number, my: number): string | null => {
    for (const col of columns) {
      const [cx, cy] = toScreen(col.position.x, col.position.y)
      const cw = col.width * scale
      const cd = col.depth * scale
      if (mx >= cx - cw / 2 - 3 && mx <= cx + cw / 2 + 3 &&
          my >= cy - cd / 2 - 3 && my <= cy + cd / 2 + 3) {
        return col.id
      }
    }
    return null
  }

  // Parse dimension value — auto-detect meters vs mm from S910
  const parseDimValue = (raw: string): number => {
    // Clean up: remove spaces, commas → dots
    let cleaned = raw.trim().replace(/,/g, '.').replace(/\s/g, '')
    // Remove trailing units if S910 sends them
    cleaned = cleaned.replace(/mm$/i, '').replace(/m$/i, '')

    const val = parseFloat(cleaned)
    if (isNaN(val)) return 0

    // Auto-detect: if value has decimal and is < 100, likely meters → convert to mm
    // e.g. 2.345 → 2345mm, 0.850 → 850mm
    // Values >= 100 are already in mm (e.g. 2300)
    if (cleaned.includes('.') && val < 100) {
      return Math.round(val * 1000)
    }
    return Math.round(val)
  }

  const applyDimEdit = () => {
    if (!editingDimWallId) return
    const targetLen = parseDimValue(editValue)
    if (targetLen < 10) { setEditingDimWallId(null); return }

    const w = walls.find(ww => ww.id === editingDimWallId)
    if (!w) { setEditingDimWallId(null); return }

    const curLen = wallLength(w)
    if (curLen < 1) { setEditingDimWallId(null); return }

    // Atomic: resize + propagate + enforce constraints in store
    useRoomStore.getState().applyDimension(editingDimWallId, targetLen)

    setEditingDimWallId(null)
  }

  const openDimEditor = (wallId: string) => {
    const w = walls.find(ww => ww.id === wallId)
    if (!w) return

    // Check over-constraint — already dimensioned walls can be edited
    if (!w.dimensionValue && useRoomStore.getState().isOverConstrained(wallId)) {
      setOverConstrainedWallId(wallId)
      selectWall(wallId)
      return
    }

    const len = Math.round(wallLength(w))
    setEditingDimWallId(wallId)
    setEditValue(String(len))
    selectWall(wallId)
  }

  // Leica DISTO: auto-fill dimension from laser measurement
  useEffect(() => {
    if (!distoHook) return
    distoHook.onMeasurement((distanceMM: number) => {
      if (editingDimWallId) {
        // Dimension editor is open → fill the value and apply
        setEditValue(String(distanceMM))
      } else if (selectedWallId) {
        // A wall is selected → open dimension editor with laser value
        setEditingDimWallId(selectedWallId)
        setEditValue(String(distanceMM))
      }
    })
  }, [distoHook, editingDimWallId, selectedWallId])

  // iPad: force focus on dimension input when it appears
  useEffect(() => {
    if (editingDimWallId && dimInputRef.current) {
      // Multiple attempts — iPad Safari needs delay after render
      const el = dimInputRef.current
      el.focus()
      el.select()
      setTimeout(() => { el.focus(); el.select() }, 50)
      setTimeout(() => { el.focus(); el.select() }, 200)
    }
  }, [editingDimWallId])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (editingDimWallId) return
    const [mx, my] = getMousePos(e)
    const [wx, wy] = toWorld(mx, my)

    // Middle/right click = always pan
    if (e.button === 1 || e.button === 2) {
      setDragTarget({ type: 'pan', startPanX: panX, startPanY: panY, startMouseX: mx, startMouseY: my })
      return
    }

    // --- Check constraint glyph click (any tool, any button) ---
    const constraintGlyphHit = findConstraintGlyphAt(mx, my)
    if (constraintGlyphHit) {
      // Toggle selection: click again to deselect
      setSelectedConstraintWallId(prev => prev === constraintGlyphHit ? null : constraintGlyphHit)
      return
    }
    // Clicking elsewhere clears constraint glyph selection
    setSelectedConstraintWallId(null)

    // --- Check dimension label click first (any tool) ---
    const dimHit = findDimAt(mx, my)
    if (dimHit) {
      openDimEditor(dimHit.wallId)
      return
    }

    // --- Tool-specific behavior ---
    if (sketchTool === 'line' || sketchTool === 'construction') {
      const snapped = snapToEndpoint(wx, wy)
      if (!drawStart) {
        setDrawStart(snapped)
      } else {
        if (sketchTool === 'construction') {
          addGuide(drawStart, snapped)
          setDrawStart(null)
        } else {
          addWall(drawStart, snapped)
          // Chain: use the actual joined endpoint (may have been auto-snapped)
          const lastWall = useRoomStore.getState().walls[useRoomStore.getState().walls.length - 1]
          setDrawStart(lastWall ? lastWall.end : snapped)
        }
      }
      return
    }

    if (sketchTool === 'rectangle') {
      const snapped = snapToEndpoint(wx, wy)
      if (!rectStart) {
        setRectStart(snapped)
      } else {
        const x1 = Math.min(rectStart.x, snapped.x)
        const y1 = Math.min(rectStart.y, snapped.y)
        const x2 = Math.max(rectStart.x, snapped.x)
        const y2 = Math.max(rectStart.y, snapped.y)
        if (Math.abs(x2 - x1) > 100 && Math.abs(y2 - y1) > 100) {
          useRoomStore.getState().clearWalls()
          useRoomStore.getState().setRoomRect(x2 - x1, y2 - y1)
        }
        setRectStart(null)
        setSketchTool('select')
      }
      return
    }

    if (sketchTool === 'trim') {
      const hit = findWallAt(mx, my)
      if (hit) { removeWall(hit.wallId); return }
      const guideId = findGuideAt(mx, my)
      if (guideId) { removeGuide(guideId); return }
      const colId = findColumnAt(mx, my)
      if (colId) { removeColumn(colId); return }
      return
    }

    // ─── CONSTRAINTS ───
    if (sketchTool === 'hv') {
      const hit = findWallAt(mx, my)
      if (hit) {
        useRoomStore.getState().applyHVConstraint(hit.wallId)
        selectWall(hit.wallId)
      }
      return
    }

    if (sketchTool === 'perpendicular' || sketchTool === 'equal' || sketchTool === 'parallel') {
      const hit = findWallAt(mx, my)
      if (!hit) return
      if (!constraintFirstWallId) {
        setConstraintFirstWallId(hit.wallId)
        selectWall(hit.wallId)
        return
      }
      const firstWall = walls.find(ww => ww.id === constraintFirstWallId)
      const secondWall = walls.find(ww => ww.id === hit.wallId)
      if (!firstWall || !secondWall || firstWall.id === secondWall.id) {
        setConstraintFirstWallId(null)
        return
      }

      if (sketchTool === 'perpendicular') {
        const fdx = firstWall.end.x - firstWall.start.x
        const fdy = firstWall.end.y - firstWall.start.y
        const sdx = secondWall.end.x - secondWall.start.x
        const sdy = secondWall.end.y - secondWall.start.y
        const sLen = Math.sqrt(sdx * sdx + sdy * sdy)
        const perpDx = -fdy
        const perpDy = fdx
        const perpLen = Math.sqrt(perpDx * perpDx + perpDy * perpDy)
        if (perpLen > 0 && sLen > 0) {
          const ux = perpDx / perpLen
          const uy = perpDy / perpLen
          updateWall(hit.wallId, {
            end: { x: snap(secondWall.start.x + ux * sLen), y: snap(secondWall.start.y + uy * sLen) }
          })
        }
      } else if (sketchTool === 'equal') {
        const fLen = wallLength(firstWall)
        const sdx = secondWall.end.x - secondWall.start.x
        const sdy = secondWall.end.y - secondWall.start.y
        const sLen = Math.sqrt(sdx * sdx + sdy * sdy)
        if (sLen > 0) {
          const ratio = fLen / sLen
          updateWall(hit.wallId, {
            end: { x: snap(secondWall.start.x + sdx * ratio), y: snap(secondWall.start.y + sdy * ratio) }
          })
        }
      } else if (sketchTool === 'parallel') {
        const fdx = firstWall.end.x - firstWall.start.x
        const fdy = firstWall.end.y - firstWall.start.y
        const fLen = Math.sqrt(fdx * fdx + fdy * fdy)
        const sLen = wallLength(secondWall)
        if (fLen > 0 && sLen > 0) {
          const ux = fdx / fLen
          const uy = fdy / fLen
          updateWall(hit.wallId, {
            end: { x: snap(secondWall.start.x + ux * sLen), y: snap(secondWall.start.y + uy * sLen) }
          })
        }
      }
      setConstraintFirstWallId(null)
      selectWall(hit.wallId)
      return
    }

    if (sketchTool === 'coincident') {
      const ep = findEndpointAt(mx, my)
      if (!ep) return
      if (!coincidentFirst) {
        // First click — select this endpoint
        setCoincidentFirst(ep)
        selectWall(ep.wallId)
        return
      }
      // Second click — merge: move second point to first point
      // (skip if same exact point)
      if (ep.wallId === coincidentFirst.wallId && ep.part === coincidentFirst.part) {
        setCoincidentFirst(null)
        return
      }
      useRoomStore.getState().applyCoincident(ep.wallId, ep.part, coincidentFirst.point)
      setCoincidentFirst(null)
      selectWall(ep.wallId)
      return
    }

    if (sketchTool === 'dimension') {
      // Dimension tool: click a line → open editable dimension
      const hit = findWallAt(mx, my)
      if (hit) {
        openDimEditor(hit.wallId)
      }
      return
    }

    if (sketchTool === 'door' || sketchTool === 'window') {
      // If dialog is still open, ignore clicks on canvas
      const showDialog = useUIStore.getState().showOpeningDialog
      if (showDialog) return

      const preset = useUIStore.getState().openingPreset
      if (!preset) return

      const hit = findWallAt(mx, my)
      if (!hit) return
      const w = walls.find(ww => ww.id === hit.wallId)
      if (!w) return
      const wLen = wallLength(w)
      const clickOffset = (hit.t ?? 0.5) * wLen

      // Place with preset size, centered on click
      const offset = clickOffset - preset.width / 2
      addOpening(hit.wallId, sketchTool, offset, preset.width)

      // Apply preset properties to the just-added opening
      const updatedWall = useRoomStore.getState().walls.find(ww => ww.id === hit.wallId)
      if (updatedWall) {
        const lastOpening = updatedWall.openings[updatedWall.openings.length - 1]
        if (lastOpening) {
          useRoomStore.getState().updateOpeningNoHistory(hit.wallId, lastOpening.id, {
            height: preset.height,
            sillHeight: preset.sillHeight,
            hingePosition: preset.hingePosition,
            swingSide: preset.swingSide,
          })
        }
      }
      selectWall(hit.wallId)
      return
    }

    if (sketchTool === 'column') {
      const snapped = snapToEndpoint(wx, wy)
      addColumn(snapped)
      return
    }

    // --- Select tool ---
    const colId = findColumnAt(mx, my)
    if (colId) {
      const col = columns.find(c => c.id === colId)!
      useRoomStore.getState().pushHistory() // save before drag
      setDragTarget({
        type: 'column-move', columnId: colId,
        offsetX: wx - col.position.x, offsetY: wy - col.position.y,
      })
      selectWall(null)
      return
    }

    // Check opening hit first (for dragging along wall)
    const openingHit = findOpeningAt(mx, my)
    if (openingHit) {
      selectWall(openingHit.wallId)
      useRoomStore.getState().pushHistory()
      setDragTarget({ type: 'opening-move', wallId: openingHit.wallId, openingId: openingHit.openingId })
      return
    }

    const hit = findWallAt(mx, my)
    if (hit) {
      selectWall(hit.wallId)
      useRoomStore.getState().pushHistory() // save before drag
      if (hit.part === 'start') {
        setDragTarget({ type: 'wall-start', wallId: hit.wallId })
      } else if (hit.part === 'end') {
        setDragTarget({ type: 'wall-end', wallId: hit.wallId })
      } else {
        const w = walls.find(ww => ww.id === hit.wallId)!
        setDragTarget({
          type: 'wall-move', wallId: hit.wallId,
          offsetX: wx - w.start.x, offsetY: wy - w.start.y,
        })
      }
    } else {
      selectWall(null)
      if (sketchTool === 'select') {
        // Start lasso selection for joining endpoints
        setLassoStart({ sx: mx, sy: my })
        setLassoEnd({ sx: mx, sy: my })
      } else {
        setDragTarget({ type: 'pan', startPanX: panX, startPanY: panY, startMouseX: mx, startMouseY: my })
      }
    }
  }

  // Double-click on wall = open dimension editor (any tool)
  const handleDoubleClick = (e: React.MouseEvent) => {
    const [mx, my] = getMousePos(e)
    const hit = findWallAt(mx, my)
    if (hit) {
      openDimEditor(hit.wallId)
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    const [mx, my] = getMousePos(e)
    const [wx, wy] = toWorld(mx, my)
    setMouseWorld({ x: wx, y: wy })

    if (editingDimWallId) return

    // Lasso drag
    if (lassoStart) {
      setLassoEnd({ sx: mx, sy: my })
      return
    }

    if (!dragTarget) {
      const hit = findWallAt(mx, my)
      const col = findColumnAt(mx, my)
      setHoverWallId(hit?.wallId || null)
      // Check constraint glyph hover
      const constraintGlyph = findConstraintGlyphAt(mx, my)
      setHoveredConstraintWallId(constraintGlyph)
      const canvas = canvasRef.current
      if (canvas) {
        // Constraint glyph hover takes priority for cursor
        if (constraintGlyph) {
          canvas.style.cursor = 'pointer'
        } else if (sketchTool === 'line' || sketchTool === 'rectangle' || sketchTool === 'construction') {
          canvas.style.cursor = 'crosshair'
        } else if (sketchTool === 'hv' || sketchTool === 'perpendicular' || sketchTool === 'equal' || sketchTool === 'parallel' || sketchTool === 'coincident' || sketchTool === 'fix' || sketchTool === 'symmetric') {
          canvas.style.cursor = hit ? 'pointer' : 'default'
        } else if (sketchTool === 'trim') {
          const guide = findGuideAt(mx, my)
          canvas.style.cursor = (hit || guide || col) ? 'pointer' : 'default'
        } else if (sketchTool === 'door' || sketchTool === 'window') {
          canvas.style.cursor = hit ? 'pointer' : 'not-allowed'
        } else if (sketchTool === 'column') {
          canvas.style.cursor = 'crosshair'
        } else if (sketchTool === 'dimension') {
          canvas.style.cursor = hit ? 'pointer' : 'default'
        } else {
          // Select tool
          const dimHit = findDimAt(mx, my)
          const opHit = findOpeningAt(mx, my)
          canvas.style.cursor = dimHit ? 'text' : opHit ? 'grab' : col ? 'move' : hit ? (hit.part === 'body' ? 'move' : 'crosshair') : 'default'
        }
      }
      return
    }

    if (dragTarget.type === 'pan') {
      setPanX(dragTarget.startPanX + mx - dragTarget.startMouseX)
      setPanY(dragTarget.startPanY + my - dragTarget.startMouseY)
      return
    }

    const snappedX = snap(wx)
    const snappedY = snap(wy)

    if (dragTarget.type === 'column-move') {
      updateColumn(dragTarget.columnId, { position: { x: snappedX, y: snappedY } })
      return
    }

    if (dragTarget.type === 'opening-move') {
      const w = walls.find(ww => ww.id === dragTarget.wallId)
      if (!w) return
      const op = w.openings.find(o => o.id === dragTarget.openingId)
      if (!op) return
      const wLen = wallLength(w)
      // Project world point onto wall to get offset
      const wdx = w.end.x - w.start.x
      const wdy = w.end.y - w.start.y
      const t = ((wx - w.start.x) * wdx + (wy - w.start.y) * wdy) / (wdx * wdx + wdy * wdy)
      let newOffset = t * wLen - op.width / 2
      newOffset = Math.max(0, Math.min(wLen - op.width, newOffset))
      newOffset = Math.round(newOffset / 50) * 50
      if (Math.abs(newOffset - op.offsetFromStart) > 1) {
        useRoomStore.getState().updateOpeningNoHistory(dragTarget.wallId, dragTarget.openingId, { offsetFromStart: newOffset })
      }
      return
    }

    // Enforce H/V constraint during drag
    const dragWall = walls.find(ww => ww.id === dragTarget.wallId)
    if (dragTarget.type === 'wall-start') {
      let sx = snappedX, sy = snappedY
      if (dragWall?.constraint === 'H') sy = dragWall.end.y
      if (dragWall?.constraint === 'V') sx = dragWall.end.x
      updateWall(dragTarget.wallId, { start: { x: sx, y: sy } })
    } else if (dragTarget.type === 'wall-end') {
      let ex = snappedX, ey = snappedY
      if (dragWall?.constraint === 'H') ey = dragWall.start.y
      if (dragWall?.constraint === 'V') ex = dragWall.start.x
      updateWall(dragTarget.wallId, { end: { x: ex, y: ey } })
    } else if (dragTarget.type === 'wall-move') {
      const w = walls.find(ww => ww.id === dragTarget.wallId)
      if (!w) return
      const ddx = w.end.x - w.start.x
      const ddy = w.end.y - w.start.y
      const newStartX = snap(snappedX - dragTarget.offsetX)
      const newStartY = snap(snappedY - dragTarget.offsetY)
      updateWall(dragTarget.wallId, {
        start: { x: newStartX, y: newStartY },
        end: { x: newStartX + ddx, y: newStartY + ddy },
      })
    }
  }

  const handleMouseUp = () => {
    // Lasso join — find all endpoints inside lasso rect, merge them to average point
    if (lassoStart && lassoEnd) {
      const x1w = Math.min(...[lassoStart, lassoEnd].map(p => toWorld(p.sx, p.sy)[0]))
      const y1w = Math.min(...[lassoStart, lassoEnd].map(p => toWorld(p.sx, p.sy)[1]))
      const x2w = Math.max(...[lassoStart, lassoEnd].map(p => toWorld(p.sx, p.sy)[0]))
      const y2w = Math.max(...[lassoStart, lassoEnd].map(p => toWorld(p.sx, p.sy)[1]))

      // Collect all endpoints inside the lasso rectangle
      const hits: { wallId: string; part: 'start' | 'end'; pt: Point2D }[] = []
      walls.forEach(w => {
        if (w.start.x >= x1w && w.start.x <= x2w && w.start.y >= y1w && w.start.y <= y2w) {
          hits.push({ wallId: w.id, part: 'start', pt: w.start })
        }
        if (w.end.x >= x1w && w.end.x <= x2w && w.end.y >= y1w && w.end.y <= y2w) {
          hits.push({ wallId: w.id, part: 'end', pt: w.end })
        }
      })

      if (hits.length >= 2) {
        // Merge all to average position
        const avgX = snap(hits.reduce((s, h) => s + h.pt.x, 0) / hits.length)
        const avgY = snap(hits.reduce((s, h) => s + h.pt.y, 0) / hits.length)
        useRoomStore.getState().pushHistory()
        hits.forEach(h => {
          updateWall(h.wallId, { [h.part]: { x: avgX, y: avgY } })
        })
        useRoomStore.getState().enforceConstraints()
      }

      setLassoStart(null)
      setLassoEnd(null)
      return
    }

    // Auto-join endpoints after dragging walls
    if (dragTarget && (dragTarget.type === 'wall-start' || dragTarget.type === 'wall-end' || dragTarget.type === 'wall-move')) {
      useRoomStore.getState().autoJoinAll()
      useRoomStore.getState().enforceConstraints()
    }
    setDragTarget(null)
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const [mx, my] = getMousePos(e)
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
    const newScale = Math.max(0.02, Math.min(2, scale * zoomFactor))
    const wxx = (mx - panX) / scale
    const wyy = (my - panY) / scale
    setPanX(mx - wxx * newScale)
    setPanY(my - wyy * newScale)
    setScale(newScale)
  }

  // --- Touch events for iPad (pinch-to-zoom + two-finger pan) ---
  const touchRef = useRef<{ lastDist: number; lastMidX: number; lastMidY: number; fingers: number } | null>(null)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault()
      const t0 = e.touches[0], t1 = e.touches[1]
      const dist = Math.sqrt((t1.clientX - t0.clientX) ** 2 + (t1.clientY - t0.clientY) ** 2)
      const midX = (t0.clientX + t1.clientX) / 2
      const midY = (t0.clientY + t1.clientY) / 2
      touchRef.current = { lastDist: dist, lastMidX: midX, lastMidY: midY, fingers: 2 }
    } else if (e.touches.length === 1) {
      touchRef.current = { lastDist: 0, lastMidX: e.touches[0].clientX, lastMidY: e.touches[0].clientY, fingers: 1 }
    }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchRef.current) return
    if (e.touches.length === 2 && touchRef.current.fingers === 2) {
      e.preventDefault()
      const t0 = e.touches[0], t1 = e.touches[1]
      const dist = Math.sqrt((t1.clientX - t0.clientX) ** 2 + (t1.clientY - t0.clientY) ** 2)
      const midX = (t0.clientX + t1.clientX) / 2
      const midY = (t0.clientY + t1.clientY) / 2

      // Pinch zoom
      const zoomFactor = dist / touchRef.current.lastDist
      const newScale = Math.max(0.02, Math.min(2, scale * zoomFactor))

      // Pan (two-finger drag)
      const dx = midX - touchRef.current.lastMidX
      const dy = midY - touchRef.current.lastMidY

      // Zoom toward pinch center
      const rect = canvasRef.current?.getBoundingClientRect()
      const cx = midX - (rect?.left ?? 0)
      const cy = midY - (rect?.top ?? 0)
      const wx = (cx - panX) / scale
      const wy = (cy - panY) / scale

      setPanX(cx - wx * newScale + dx)
      setPanY(cy - wy * newScale + dy)
      setScale(newScale)

      touchRef.current = { lastDist: dist, lastMidX: midX, lastMidY: midY, fingers: 2 }
    }
  }, [scale, panX, panY])

  const handleTouchEnd = useCallback(() => {
    touchRef.current = null
  }, [])

  // Compute editing dimension overlay position
  const editingWall = editingDimWallId ? walls.find(w => w.id === editingDimWallId) : null
  const editDimPos = editingWall ? getDimScreenPos(editingWall) : null

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ display: 'block', touchAction: 'none' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        onContextMenu={e => {
          e.preventDefault()
          setContextMenu({ x: e.clientX, y: e.clientY })
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      />

      {/* Editable dimension input overlay — Fusion 360 style + S910 BT keyboard support */}
      {editingDimWallId && editDimPos && (
        <div
          className="absolute flex flex-col items-center"
          style={{
            left: editDimPos.labelX - 75,
            top: editDimPos.labelY - 20,
            zIndex: 100,
            touchAction: 'auto',
          }}
          onTouchStart={e => e.stopPropagation()}
          onTouchMove={e => e.stopPropagation()}
          onTouchEnd={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
        >
          <input
            ref={dimInputRef}
            type="text"
            inputMode="decimal"
            enterKeyHint="done"
            value={editValue}
            onFocus={e => e.target.select()}
            onChange={e => {
              // Accept numbers, dots, commas from S910
              const v = e.target.value.replace(/[^0-9.,\s]/g, '')
              setEditValue(v)
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); applyDimEdit() }
              if (e.key === 'Escape') setEditingDimWallId(null)
              if (e.key === 'Tab') e.preventDefault() // S910 may send Tab
            }}
            onBlur={() => {
              // Don't auto-apply on blur — iPad keyboard causes blur when appearing
              // User must press Enter, Done, or ✓ Apply button
            }}
            className="border-2 rounded px-2 py-1 text-sm text-center font-bold shadow-lg outline-none"
            style={{
              width: 150,
              background: '#ffffff',
              borderColor: '#0055aa',
              color: '#0055aa',
              fontSize: 20,
              touchAction: 'auto',
              WebkitUserSelect: 'text',
              userSelect: 'text',
            }}
            placeholder="mm"
          />
          <div className="flex gap-2 mt-1">
            <button
              onClick={() => setEditingDimWallId(null)}
              className="bg-gray-600 hover:bg-gray-500 text-white text-xs font-bold px-3 py-1.5 rounded"
              style={{ touchAction: 'auto' }}
            >
              Cancel
            </button>
            {editingDimWallId && walls.find(w => w.id === editingDimWallId)?.dimensionValue && (
              <button
                onClick={() => {
                  useRoomStore.getState().removeDimension(editingDimWallId)
                  setEditingDimWallId(null)
                }}
                className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded"
                style={{ touchAction: 'auto' }}
              >
                Remove
              </button>
            )}
            <button
              onClick={applyDimEdit}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-1.5 rounded"
              style={{ touchAction: 'auto' }}
            >
              Apply
            </button>
          </div>
          <span style={{ color: '#666', fontSize: 10, marginTop: 2 }}>
            mm (or m auto-convert)
          </span>
        </div>
      )}
      {/* Zoom buttons — bottom-right */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1.5 z-30">
        <button
          onClick={() => {
            // Zoom Fit: fit all walls into view with padding
            if (walls.length === 0) return
            const canvas = canvasRef.current
            if (!canvas) return
            const cw = canvas.clientWidth
            const ch = canvas.clientHeight
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
            for (const w of walls) {
              minX = Math.min(minX, w.start.x, w.end.x)
              minY = Math.min(minY, w.start.y, w.end.y)
              maxX = Math.max(maxX, w.start.x, w.end.x)
              maxY = Math.max(maxY, w.start.y, w.end.y)
            }
            for (const c of useRoomStore.getState().columns) {
              minX = Math.min(minX, c.position.x - c.width / 2)
              minY = Math.min(minY, c.position.y - c.depth / 2)
              maxX = Math.max(maxX, c.position.x + c.width / 2)
              maxY = Math.max(maxY, c.position.y + c.depth / 2)
            }
            const pad = 80
            const ww = maxX - minX || 1000
            const hh = maxY - minY || 1000
            const fitScale = Math.min((cw - pad * 2) / ww, (ch - pad * 2) / hh, 2)
            const newScale = Math.max(0.02, fitScale)
            const cx = (minX + maxX) / 2
            const cy = (minY + maxY) / 2
            setPanX(cw / 2 - cx * newScale)
            setPanY(ch / 2 - cy * newScale)
            setScale(newScale)
          }}
          className="bg-white hover:bg-gray-100 border border-gray-300 shadow-md rounded-lg w-9 h-9 flex items-center justify-center text-gray-700 text-sm font-bold"
          title="Zoom Fit"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
        </button>
        <button
          onClick={() => {
            const canvas = canvasRef.current
            if (!canvas) return
            const cx = canvas.clientWidth / 2
            const cy = canvas.clientHeight / 2
            const newScale = Math.max(0.02, Math.min(2, scale * 1.3))
            const wx = (cx - panX) / scale
            const wy = (cy - panY) / scale
            setPanX(cx - wx * newScale)
            setPanY(cy - wy * newScale)
            setScale(newScale)
          }}
          className="bg-white hover:bg-gray-100 border border-gray-300 shadow-md rounded-lg w-9 h-9 flex items-center justify-center text-gray-700 text-lg font-bold"
          title="Zoom In"
        >
          +
        </button>
        <button
          onClick={() => {
            const canvas = canvasRef.current
            if (!canvas) return
            const cx = canvas.clientWidth / 2
            const cy = canvas.clientHeight / 2
            const newScale = Math.max(0.02, Math.min(2, scale * 0.7))
            const wx = (cx - panX) / scale
            const wy = (cy - panY) / scale
            setPanX(cx - wx * newScale)
            setPanY(cy - wy * newScale)
            setScale(newScale)
          }}
          className="bg-white hover:bg-gray-100 border border-gray-300 shadow-md rounded-lg w-9 h-9 flex items-center justify-center text-gray-700 text-lg font-bold"
          title="Zoom Out"
        >
          −
        </button>
      </div>

      {/* Over-constrained warning dialog */}
      {overConstrainedWallId && (() => {
        const ocWall = walls.find(w => w.id === overConstrainedWallId)
        const ocDim = ocWall ? getDimScreenPos(ocWall) : null
        return (
          <div
            className="absolute bg-[#1e1e30] border border-yellow-500/60 rounded-lg shadow-2xl p-4"
            style={{
              left: ocDim ? Math.min(ocDim.labelX, 300) : 100,
              top: ocDim ? Math.min(ocDim.labelY - 60, 200) : 100,
              zIndex: 200,
              maxWidth: 280,
            }}
            onMouseDown={e => e.stopPropagation()}
            onTouchStart={e => e.stopPropagation()}
          >
            <div className="text-yellow-400 font-bold text-sm mb-2">Over-constrained</div>
            <div className="text-gray-300 text-xs mb-3">
              เส้นนี้ถูกกำหนดโดย dimension อื่นแล้ว ใส่ dimension เพิ่มจะทำให้ขัดแย้ง
              <br />ต้องลบ dimension เส้นอื่นก่อน
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setOverConstrainedWallId(null)}
                className="flex-1 bg-gray-600 hover:bg-gray-500 text-white text-xs font-bold px-3 py-1.5 rounded"
              >
                OK
              </button>
            </div>
          </div>
        )
      })()}

      {/* Opening preset dialog */}
      <OpeningDialog />

      {/* Right-click context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onZoomIn={() => {
            const canvas = canvasRef.current
            if (!canvas) return
            const cx = canvas.clientWidth / 2, cy = canvas.clientHeight / 2
            const ns = Math.max(0.02, Math.min(2, scale * 1.3))
            const wx = (cx - panX) / scale, wy = (cy - panY) / scale
            setPanX(cx - wx * ns); setPanY(cy - wy * ns); setScale(ns)
          }}
          onZoomOut={() => {
            const canvas = canvasRef.current
            if (!canvas) return
            const cx = canvas.clientWidth / 2, cy = canvas.clientHeight / 2
            const ns = Math.max(0.02, Math.min(2, scale * 0.7))
            const wx = (cx - panX) / scale, wy = (cy - panY) / scale
            setPanX(cx - wx * ns); setPanY(cy - wy * ns); setScale(ns)
          }}
          onZoomFit={() => {
            if (walls.length === 0) return
            const canvas = canvasRef.current
            if (!canvas) return
            const cw = canvas.clientWidth, ch = canvas.clientHeight
            let mnX = Infinity, mnY = Infinity, mxX = -Infinity, mxY = -Infinity
            for (const w of walls) {
              mnX = Math.min(mnX, w.start.x, w.end.x); mnY = Math.min(mnY, w.start.y, w.end.y)
              mxX = Math.max(mxX, w.start.x, w.end.x); mxY = Math.max(mxY, w.start.y, w.end.y)
            }
            const pad = 80, ww = mxX - mnX || 1000, hh = mxY - mnY || 1000
            const ns = Math.max(0.02, Math.min(2, Math.min((cw - pad * 2) / ww, (ch - pad * 2) / hh)))
            setPanX(cw / 2 - (mnX + mxX) / 2 * ns); setPanY(ch / 2 - (mnY + mxY) / 2 * ns); setScale(ns)
          }}
        />
      )}
    </div>
  )
}
