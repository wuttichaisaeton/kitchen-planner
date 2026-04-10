import { useRef, useEffect, useState, useCallback } from 'react'
import { useRoomStore } from '../../store/useRoomStore'
import { useUIStore } from '../../store/useUIStore'
import { usePlacementStore } from '../../store/usePlacementStore'
import { catalogItems } from '../../data/catalogItems'
import { Wall, Point2D } from '../../types/kitchen'
import type { UseLeicaDistoReturn } from '../../hooks/useLeicaDisto'

const GRID_SIZE = 100
const SNAP = 50
const SNAP_RADIUS = 12 // px for endpoint snapping

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

  // Canvas mount trigger
  const [canvasReady, setCanvasReady] = useState(0)

  // Drawing state for line tool
  const [drawStart, setDrawStart] = useState<Point2D | null>(null)
  const [mouseWorld, setMouseWorld] = useState<Point2D>({ x: 0, y: 0 })

  // Drawing state for rectangle tool
  const [rectStart, setRectStart] = useState<Point2D | null>(null)

  // Constraint: first wall selected (for two-click constraints)
  const [constraintFirstWallId, setConstraintFirstWallId] = useState<string | null>(null)

  // Editable dimension — wallId based, position computed dynamically
  const [editingDimWallId, setEditingDimWallId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const toScreen = useCallback((wx: number, wy: number): [number, number] => {
    return [wx * scale + panX, wy * scale + panY]
  }, [scale, panX, panY])

  const toWorld = useCallback((sx: number, sy: number): [number, number] => {
    return [(sx - panX) / scale, (sy - panY) / scale]
  }, [scale, panX, panY])

  // Snap to existing wall endpoints
  const snapToEndpoint = useCallback((wx: number, wy: number): Point2D => {
    const threshold = SNAP_RADIUS / scale
    let bestDist = threshold
    let result: Point2D = { x: snap(wx), y: snap(wy) }

    for (const w of walls) {
      for (const pt of [w.start, w.end]) {
        const d = Math.sqrt((wx - pt.x) ** 2 + (wy - pt.y) ** 2)
        if (d < bestDist) {
          bestDist = d
          result = { x: pt.x, y: pt.y }
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
        setSketchTool('select')
        return
      }
      // Tool shortcuts (Fusion 360 style)
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (e.key === ' ') {
        e.preventDefault()
        const last = useUIStore.getState().lastSketchTool
        setSketchTool(last)
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
  }, [editingDimWallId, setSketchTool])

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

    // Fusion 360 dark canvas
    ctx.fillStyle = '#2d2d3d'
    ctx.fillRect(0, 0, W, H)

    // Grid (Fusion 360 style — subtle dark lines)
    const gridPx = GRID_SIZE * scale
    if (gridPx > 6) {
      const startWX = -panX / scale
      const startWY = -panY / scale
      const endWX = (W - panX) / scale
      const endWY = (H - panY) / scale

      // Minor grid
      const gx0 = Math.floor(startWX / GRID_SIZE) * GRID_SIZE
      const gy0 = Math.floor(startWY / GRID_SIZE) * GRID_SIZE
      ctx.strokeStyle = '#363648'
      ctx.lineWidth = 0.5
      for (let wx = gx0; wx <= endWX; wx += GRID_SIZE) {
        const [sx] = toScreen(wx, 0)
        ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, H); ctx.stroke()
      }
      for (let wy = gy0; wy <= endWY; wy += GRID_SIZE) {
        const [, sy] = toScreen(0, wy)
        ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(W, sy); ctx.stroke()
      }

      // Major grid lines every 1000mm
      ctx.strokeStyle = '#404058'
      ctx.lineWidth = 0.8
      const mg = 1000
      const mgx0 = Math.floor(startWX / mg) * mg
      const mgy0 = Math.floor(startWY / mg) * mg
      for (let wx = mgx0; wx <= endWX; wx += mg) {
        const [sx] = toScreen(wx, 0)
        ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, H); ctx.stroke()
      }
      for (let wy = mgy0; wy <= endWY; wy += mg) {
        const [, sy] = toScreen(0, wy)
        ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(W, sy); ctx.stroke()
      }
    }

    // Origin crosshair
    const [ox, oy] = toScreen(0, 0)
    ctx.strokeStyle = '#ff444466'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, H); ctx.stroke()
    ctx.strokeStyle = '#44ff4466'
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(W, oy); ctx.stroke()

    // --- Draw sketch lines (walls as thin lines — Fusion 360 style) ---
    walls.forEach(w => {
      const [sx, sy] = toScreen(w.start.x, w.start.y)
      const [ex, ey] = toScreen(w.end.x, w.end.y)
      const isSelected = w.id === selectedWallId
      const isHovered = w.id === hoverWallId
      const isEditing = w.id === editingDimWallId
      const isTrimHover = sketchTool === 'trim' && isHovered

      // Sketch line (thin, like Fusion 360)
      if (isTrimHover) {
        ctx.strokeStyle = '#ff4444'
        ctx.lineWidth = 3
      } else if (isEditing) {
        ctx.strokeStyle = '#00ccff'
        ctx.lineWidth = 2.5
      } else if (isSelected) {
        ctx.strokeStyle = '#00aaff'
        ctx.lineWidth = 2.5
      } else if (isHovered) {
        ctx.strokeStyle = '#66ccff'
        ctx.lineWidth = 2
      } else {
        ctx.strokeStyle = '#e0e0e8'
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

        if (op.type === 'door') {
          // Door gap (break in line)
          ctx.strokeStyle = '#8B6914'
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.moveTo(ox1, oy1)
          ctx.lineTo(ox2, oy2)
          ctx.stroke()
          // Door swing arc
          const doorWidth = op.width * scale
          const angle = Math.atan2(ey - sy, ex - sx)
          ctx.strokeStyle = '#8B691466'
          ctx.lineWidth = 1
          ctx.setLineDash([3, 3])
          ctx.beginPath()
          ctx.arc(ox1, oy1, doorWidth, angle - Math.PI / 2, angle, false)
          ctx.stroke()
          ctx.setLineDash([])
        } else {
          // Window — cyan double lines
          const wnx = nx * thick * 0.3
          const wny = ny * thick * 0.3
          ctx.strokeStyle = '#4a90d9'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(ox1 + wnx, oy1 + wny)
          ctx.lineTo(ox2 + wnx, oy2 + wny)
          ctx.stroke()
          ctx.beginPath()
          ctx.moveTo(ox1 - wnx, oy1 - wny)
          ctx.lineTo(ox2 - wnx, oy2 - wny)
          ctx.stroke()
        }
      })

      // Endpoint dots (Fusion 360 style — small squares/circles)
      const dotR = isSelected || isHovered ? 4 : 3
      for (const [px, py] of [[sx, sy], [ex, ey]] as const) {
        ctx.fillStyle = isSelected ? '#00aaff' : isHovered ? '#66ccff' : '#aaaabb'
        ctx.beginPath()
        ctx.arc(px, py, dotR, 0, Math.PI * 2)
        ctx.fill()
      }

      // --- Show dimension for selected/hovered wall or all walls with dimension tool ---
      const showDim = isSelected || isEditing || sketchTool === 'dimension'
      if (showDim) {
        const dimInfo = getDimScreenPos(w)
        if (dimInfo) {
          const { sx: d1x, sy: d1y, ex: d2x, ey: d2y, labelX, labelY, length } = dimInfo
          const dimFontSize = Math.max(10, Math.min(14, 12 / Math.sqrt(scale / 0.15)))

          // Dimension line
          ctx.strokeStyle = '#00ccff88'
          ctx.lineWidth = 0.8
          ctx.beginPath()
          ctx.moveTo(d1x, d1y)
          ctx.lineTo(d2x, d2y)
          ctx.stroke()

          // Extension lines
          ctx.strokeStyle = '#00ccff44'
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
            ctx.fillStyle = '#00ccff'
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

          // Dimension label (Fusion 360 style — dark bg, cyan text)
          if (!isEditing) {
            const label = `${length} mm`
            ctx.font = `bold ${dimFontSize}px sans-serif`
            const metrics = ctx.measureText(label)
            const padX = 8
            const padY = 4
            const boxW = metrics.width + padX * 2
            const boxH = dimFontSize + padY * 2 + 2

            // Dark box background
            ctx.fillStyle = '#1a1a2eee'
            ctx.strokeStyle = '#00ccff88'
            ctx.lineWidth = 1
            const bx = labelX - boxW / 2
            const by = labelY - boxH / 2
            ctx.beginPath()
            ctx.roundRect(bx, by, boxW, boxH, 3)
            ctx.fill()
            ctx.stroke()

            // Cyan text
            ctx.fillStyle = '#00ccff'
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
      ctx.fillStyle = '#ffffff22'
      ctx.fillText(`${sqm} m\u00B2`, roomCX, roomCY - 8)
      ctx.font = `${dimFontSize - 1}px sans-serif`
      ctx.fillStyle = '#ffffff18'
      ctx.fillText(`${Math.round(perimeter)} mm`, roomCX, roomCY + 10)
    }

    // --- Draw line preview (while drawing — Fusion 360 style) ---
    if (drawStart && sketchTool === 'line') {
      const [sx, sy] = toScreen(drawStart.x, drawStart.y)
      const snapped = snapToEndpoint(mouseWorld.x, mouseWorld.y)
      const [ex, ey] = toScreen(snapped.x, snapped.y)

      // Preview line
      ctx.strokeStyle = '#00aaff'
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
        ctx.fillStyle = '#1a1a2eee'
        ctx.strokeStyle = '#00aaff88'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.roundRect(lx - boxW / 2, ly - boxH / 2, boxW, boxH, 3)
        ctx.fill()
        ctx.stroke()

        ctx.fillStyle = '#00ccff'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(label, lx, ly)
      }

      // Start/end points
      ctx.fillStyle = '#00aaff'
      ctx.beginPath(); ctx.arc(sx, sy, 4, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#00ffaa'
      ctx.beginPath(); ctx.arc(ex, ey, 4, 0, Math.PI * 2); ctx.fill()
    }

    // --- Draw rectangle preview ---
    if (rectStart && sketchTool === 'rectangle') {
      const snapped = snapToEndpoint(mouseWorld.x, mouseWorld.y)
      const [x1, y1] = toScreen(rectStart.x, rectStart.y)
      const [x2, y2] = toScreen(snapped.x, snapped.y)

      ctx.strokeStyle = '#00aaff'
      ctx.lineWidth = 2
      ctx.setLineDash([6, 4])
      ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1))
      ctx.setLineDash([])

      // Size labels
      const rw = Math.abs(snapped.x - rectStart.x)
      const rh = Math.abs(snapped.y - rectStart.y)
      ctx.fillStyle = '#00ccff'
      ctx.font = 'bold 11px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(`${Math.round(rw)}`, (x1 + x2) / 2, Math.min(y1, y2) - 12)
      ctx.fillText(`${Math.round(rh)}`, Math.max(x1, x2) + 24, (y1 + y2) / 2)
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
      ctx.strokeStyle = '#8888aa'
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
    const scaleBarMM = scale > 0.1 ? 1000 : scale > 0.05 ? 2000 : 5000
    const scaleBarPx = scaleBarMM * scale
    const sbX = W - 20 - scaleBarPx
    const sbY = H - 20
    ctx.strokeStyle = '#666688'
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(sbX, sbY); ctx.lineTo(sbX + scaleBarPx, sbY); ctx.stroke()
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(sbX, sbY - 5); ctx.lineTo(sbX, sbY + 5); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(sbX + scaleBarPx, sbY - 5); ctx.lineTo(sbX + scaleBarPx, sbY + 5); ctx.stroke()
    ctx.fillStyle = '#8888aa'
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`${scaleBarMM} mm`, sbX + scaleBarPx / 2, sbY - 10)

    // Coordinate display
    ctx.fillStyle = '#8888aa'
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
        ctx.fillStyle = '#00ccff'
        ctx.font = 'bold 12px monospace'
        ctx.fillText(`\u21A6 ${distoHook.lastMeasurement} mm`, W - 10, H - 10)
      }
    }

  }, [walls, columns, guides, items, panX, panY, scale, selectedWallId, hoverWallId, toScreen, editingDimWallId, drawStart, rectStart, mouseWorld, sketchTool, snapToEndpoint, dragTarget, getDimScreenPos, canvasReady, distoHook])

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
      if (dist < 8) return { wallId: w.id, part: 'body', t }
    }
    return null
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

  const applyDimEdit = () => {
    if (!editingDimWallId) return
    const val = parseFloat(editValue)
    if (isNaN(val) || val < 10) { setEditingDimWallId(null); return }

    const w = walls.find(ww => ww.id === editingDimWallId)
    if (!w) { setEditingDimWallId(null); return }

    const dx = w.end.x - w.start.x
    const dy = w.end.y - w.start.y
    const curLen = Math.sqrt(dx * dx + dy * dy)
    if (curLen < 1) { setEditingDimWallId(null); return }

    // User enters the line length directly
    const targetLen = val
    const ratio = targetLen / curLen
    const newEnd = {
      x: snap(w.start.x + dx * ratio),
      y: snap(w.start.y + dy * ratio),
    }
    updateWall(w.id, { end: newEnd })

    // Update connected walls that share the old endpoint
    const EPS = 1
    walls.forEach(other => {
      if (other.id === w.id) return
      if (Math.abs(other.start.x - w.end.x) < EPS && Math.abs(other.start.y - w.end.y) < EPS) {
        updateWall(other.id, { start: { x: newEnd.x, y: newEnd.y } })
      }
      if (Math.abs(other.end.x - w.end.x) < EPS && Math.abs(other.end.y - w.end.y) < EPS) {
        updateWall(other.id, { end: { x: newEnd.x, y: newEnd.y } })
      }
    })

    setEditingDimWallId(null)
  }

  const openDimEditor = (wallId: string) => {
    const w = walls.find(ww => ww.id === wallId)
    if (!w) return
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

  const handleMouseDown = (e: React.MouseEvent) => {
    if (editingDimWallId) return
    const [mx, my] = getMousePos(e)
    const [wx, wy] = toWorld(mx, my)

    // Middle/right click = always pan
    if (e.button === 1 || e.button === 2) {
      setDragTarget({ type: 'pan', startPanX: panX, startPanY: panY, startMouseX: mx, startMouseY: my })
      return
    }

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
          setDrawStart(snapped) // chain
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
        const w = walls.find(ww => ww.id === hit.wallId)
        if (w) {
          const ddx = Math.abs(w.end.x - w.start.x)
          const ddy = Math.abs(w.end.y - w.start.y)
          const oldEnd = { ...w.end }
          let newEnd: Point2D
          if (ddx >= ddy) {
            const avgY = snap((w.start.y + w.end.y) / 2)
            newEnd = { x: w.end.x, y: avgY }
            updateWall(w.id, { start: { x: w.start.x, y: avgY }, end: newEnd })
          } else {
            const avgX = snap((w.start.x + w.end.x) / 2)
            newEnd = { x: avgX, y: w.end.y }
            updateWall(w.id, { start: { x: avgX, y: w.start.y }, end: newEnd })
          }
          // Update connected walls
          const EPS = 1
          walls.forEach(other => {
            if (other.id === w.id) return
            if (Math.abs(other.start.x - oldEnd.x) < EPS && Math.abs(other.start.y - oldEnd.y) < EPS) {
              updateWall(other.id, { start: { x: newEnd.x, y: newEnd.y } })
            }
            if (Math.abs(other.end.x - oldEnd.x) < EPS && Math.abs(other.end.y - oldEnd.y) < EPS) {
              updateWall(other.id, { end: { x: newEnd.x, y: newEnd.y } })
            }
          })
        }
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
      const hit = findWallAt(mx, my)
      if (!hit) return
      if (!constraintFirstWallId) {
        setConstraintFirstWallId(hit.wallId)
        selectWall(hit.wallId)
        return
      }
      const firstWall = walls.find(ww => ww.id === constraintFirstWallId)
      if (!firstWall || firstWall.id === hit.wallId) {
        setConstraintFirstWallId(null)
        return
      }
      const bestWallId = hit.wallId
      const bestPart = hit.part === 'body' ? 'start' : hit.part
      const targetPt = firstWall.end
      updateWall(bestWallId, { [bestPart]: { x: targetPt.x, y: targetPt.y } })
      setConstraintFirstWallId(null)
      selectWall(bestWallId)
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
      const hit = findWallAt(mx, my)
      if (hit) {
        addOpening(hit.wallId, sketchTool)
        selectWall(hit.wallId)
      }
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
      setDragTarget({
        type: 'column-move', columnId: colId,
        offsetX: wx - col.position.x, offsetY: wy - col.position.y,
      })
      selectWall(null)
      return
    }

    const hit = findWallAt(mx, my)
    if (hit) {
      selectWall(hit.wallId)
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
      setDragTarget({ type: 'pan', startPanX: panX, startPanY: panY, startMouseX: mx, startMouseY: my })
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

    if (!dragTarget) {
      const hit = findWallAt(mx, my)
      const col = findColumnAt(mx, my)
      setHoverWallId(hit?.wallId || null)
      const canvas = canvasRef.current
      if (canvas) {
        if (sketchTool === 'line' || sketchTool === 'rectangle' || sketchTool === 'construction') {
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
          canvas.style.cursor = dimHit ? 'text' : col ? 'move' : hit ? (hit.part === 'body' ? 'move' : 'crosshair') : 'default'
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

    if (dragTarget.type === 'wall-start') {
      updateWall(dragTarget.wallId, { start: { x: snappedX, y: snappedY } })
    } else if (dragTarget.type === 'wall-end') {
      updateWall(dragTarget.wallId, { end: { x: snappedX, y: snappedY } })
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

  const handleMouseUp = () => { setDragTarget(null) }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const [mx, my] = getMousePos(e)
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
    const newScale = Math.max(0.02, Math.min(0.5, scale * zoomFactor))
    const wxx = (mx - panX) / scale
    const wyy = (my - panY) / scale
    setPanX(mx - wxx * newScale)
    setPanY(my - wyy * newScale)
    setScale(newScale)
  }

  // Compute editing dimension overlay position
  const editingWall = editingDimWallId ? walls.find(w => w.id === editingDimWallId) : null
  const editDimPos = editingWall ? getDimScreenPos(editingWall) : null

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ display: 'block' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        onContextMenu={e => e.preventDefault()}
      />

      {/* Editable dimension input overlay — Fusion 360 style */}
      {editingDimWallId && editDimPos && (
        <input
          autoFocus
          type="number"
          step={50}
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') applyDimEdit()
            if (e.key === 'Escape') setEditingDimWallId(null)
          }}
          onBlur={applyDimEdit}
          className="absolute border-2 rounded px-2 py-1 text-sm text-center font-bold shadow-lg outline-none"
          style={{
            left: editDimPos.labelX - 55,
            top: editDimPos.labelY - 16,
            width: 110,
            zIndex: 10,
            background: '#1a1a2e',
            borderColor: '#00ccff',
            color: '#00ccff',
          }}
        />
      )}
    </div>
  )
}
