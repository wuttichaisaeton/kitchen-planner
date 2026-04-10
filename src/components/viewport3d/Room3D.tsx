import { useRoomStore } from '../../store/useRoomStore'
import * as THREE from 'three'
import { useMemo } from 'react'
import { Wall, Opening } from '../../types/kitchen'

/**
 * Renders a wall with openings (doors/windows) by splitting into solid segments.
 * Each opening creates a gap, and we render:
 * - Solid wall sections between openings
 * - Lintel above each opening (wall above the opening)
 * - Sill below each window (wall below the window)
 */
function WallWithOpenings({ wall }: { wall: Wall }) {
  const { start, end, height, thickness, openings } = wall
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.sqrt(dx * dx + dy * dy)
  const angle = Math.atan2(dy, dx)

  const selectedWallId = useRoomStore(s => s.selectedWallId)
  const isSelected = selectedWallId === wall.id

  // Sort openings by offset
  const sorted = useMemo(() =>
    [...openings].sort((a, b) => a.offsetFromStart - b.offsetFromStart),
    [openings]
  )

  // Build wall segments
  const segments = useMemo(() => {
    if (sorted.length === 0) {
      return [{ xStart: 0, yStart: 0, width: length, height, type: 'solid' as const }]
    }

    const segs: Array<{
      xStart: number
      yStart: number
      width: number
      height: number
      type: 'solid' | 'lintel' | 'sill'
    }> = []

    let cursor = 0
    for (const op of sorted) {
      // Solid section before this opening
      if (op.offsetFromStart > cursor) {
        segs.push({
          xStart: cursor,
          yStart: 0,
          width: op.offsetFromStart - cursor,
          height,
          type: 'solid',
        })
      }

      // Lintel above opening
      const topOfOpening = op.sillHeight + op.height
      if (topOfOpening < height) {
        segs.push({
          xStart: op.offsetFromStart,
          yStart: topOfOpening,
          width: op.width,
          height: height - topOfOpening,
          type: 'lintel',
        })
      }

      // Sill below window
      if (op.sillHeight > 0) {
        segs.push({
          xStart: op.offsetFromStart,
          yStart: 0,
          width: op.width,
          height: op.sillHeight,
          type: 'sill',
        })
      }

      cursor = op.offsetFromStart + op.width
    }

    // Solid section after last opening
    if (cursor < length) {
      segs.push({
        xStart: cursor,
        yStart: 0,
        width: length - cursor,
        height,
        type: 'solid',
      })
    }

    return segs
  }, [sorted, length, height])

  // Direction unit vectors
  const dirX = dx / length
  const dirZ = dy / length

  return (
    <group>
      {segments.map((seg, i) => {
        // Center of this segment along wall direction
        const centerAlongWall = seg.xStart + seg.width / 2
        const cx = start.x + dirX * centerAlongWall
        const cz = start.y + dirZ * centerAlongWall
        const cy = seg.yStart + seg.height / 2

        return (
          <mesh
            key={i}
            position={[cx, cy, cz]}
            rotation={[0, -angle, 0]}
            receiveShadow
            castShadow
          >
            <boxGeometry args={[seg.width, seg.height, thickness]} />
            <meshStandardMaterial
              color={isSelected ? '#d4cfc8' : '#e8e4df'}
              roughness={0.9}
            />
          </mesh>
        )
      })}

      {/* Door frame visual - dark outline */}
      {sorted.filter(o => o.type === 'door').map((op, i) => {
        const centerAlongWall = op.offsetFromStart + op.width / 2
        const cx = start.x + dirX * centerAlongWall
        const cz = start.y + dirZ * centerAlongWall
        const cy = op.height / 2

        return (
          <mesh
            key={`door-frame-${i}`}
            position={[cx, cy, cz]}
            rotation={[0, -angle, 0]}
          >
            <boxGeometry args={[op.width + 20, op.height + 10, thickness + 10]} />
            <meshStandardMaterial color="#5a4a3a" roughness={0.8} />
          </mesh>
        )
      })}

      {/* Window frame visual */}
      {sorted.filter(o => o.type === 'window').map((op, i) => {
        const centerAlongWall = op.offsetFromStart + op.width / 2
        const cx = start.x + dirX * centerAlongWall
        const cz = start.y + dirZ * centerAlongWall
        const cy = op.sillHeight + op.height / 2

        return (
          <group key={`window-${i}`}>
            {/* Frame */}
            <mesh
              position={[cx, cy, cz]}
              rotation={[0, -angle, 0]}
            >
              <boxGeometry args={[op.width + 16, op.height + 16, thickness + 6]} />
              <meshStandardMaterial color="#6a6a6a" roughness={0.5} metalness={0.3} />
            </mesh>
            {/* Glass */}
            <mesh
              position={[cx, cy, cz]}
              rotation={[0, -angle, 0]}
            >
              <boxGeometry args={[op.width - 20, op.height - 20, 6]} />
              <meshStandardMaterial
                color="#a8d4f0"
                transparent
                opacity={0.35}
                roughness={0.05}
                metalness={0.1}
              />
            </mesh>
          </group>
        )
      })}

      {/* Selection highlight */}
      {isSelected && (
        <mesh
          position={[
            (start.x + end.x) / 2,
            height / 2,
            (start.y + end.y) / 2,
          ]}
          rotation={[0, -angle, 0]}
        >
          <boxGeometry args={[length + 20, height + 20, thickness + 20]} />
          <meshBasicMaterial color="#2563eb" wireframe transparent opacity={0.3} />
        </mesh>
      )}
    </group>
  )
}

function ColumnMesh({ column }: { column: import('../../types/kitchen').Column }) {
  return (
    <mesh
      position={[column.position.x, column.height / 2, column.position.y]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[column.width, column.height, column.depth]} />
      <meshStandardMaterial color="#c0bab0" roughness={0.85} />
    </mesh>
  )
}

export default function Room3D() {
  const walls = useRoomStore(s => s.walls)
  const columns = useRoomStore(s => s.columns)

  const floorSize = useMemo(() => {
    if (walls.length === 0) return { w: 4000, d: 3000 }
    let maxX = 0, maxZ = 0
    walls.forEach(w => {
      maxX = Math.max(maxX, w.start.x, w.end.x)
      maxZ = Math.max(maxZ, w.start.y, w.end.y)
    })
    return { w: maxX, d: maxZ }
  }, [walls])

  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[floorSize.w / 2, 0, floorSize.d / 2]} receiveShadow>
        <planeGeometry args={[floorSize.w, floorSize.d]} />
        <meshStandardMaterial color="#d4c9b8" roughness={0.8} />
      </mesh>

      {/* Walls with openings */}
      {walls.map(w => (
        <WallWithOpenings key={w.id} wall={w} />
      ))}

      {/* Columns */}
      {columns.map(c => (
        <ColumnMesh key={c.id} column={c} />
      ))}
    </group>
  )
}
