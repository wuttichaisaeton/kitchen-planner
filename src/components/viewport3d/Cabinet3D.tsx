import { CatalogItem } from '../../types/kitchen'
import { useRef, useState, useCallback } from 'react'
import { usePlacementStore } from '../../store/usePlacementStore'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

const steelProps = { color: '#c0c0c0', metalness: 0.92, roughness: 0.18, envMapIntensity: 1.2 }
const steelDark = { color: '#999', metalness: 0.9, roughness: 0.25, envMapIntensity: 0.8 }

function BaseCabinet({ item }: { item: CatalogItem }) {
  const { width: w, depth: d, height: h } = item
  const t = 1.5 // panel thickness (visual)
  const kickH = 100
  const bodyH = h - kickH

  return (
    <group position={[0, kickH, 0]}>
      {/* Left side */}
      <mesh position={[t / 2, bodyH / 2, d / 2]} castShadow>
        <boxGeometry args={[t, bodyH, d]} />
        <meshStandardMaterial {...steelProps} />
      </mesh>
      {/* Right side */}
      <mesh position={[w - t / 2, bodyH / 2, d / 2]} castShadow>
        <boxGeometry args={[t, bodyH, d]} />
        <meshStandardMaterial {...steelProps} />
      </mesh>
      {/* Back */}
      <mesh position={[w / 2, bodyH / 2, t / 2]} castShadow>
        <boxGeometry args={[w, bodyH, t]} />
        <meshStandardMaterial {...steelDark} />
      </mesh>
      {/* Bottom */}
      <mesh position={[w / 2, t / 2, d / 2]} castShadow>
        <boxGeometry args={[w, t, d]} />
        <meshStandardMaterial {...steelProps} />
      </mesh>
      {/* Shelf (middle) */}
      <mesh position={[w / 2, bodyH * 0.45, d / 2]} castShadow>
        <boxGeometry args={[w - t * 2, t, d - 20]} />
        <meshStandardMaterial {...steelProps} />
      </mesh>
      {/* Door fronts */}
      <mesh position={[w / 2, bodyH / 2, d - 1]} castShadow>
        <boxGeometry args={[w - 4, bodyH - 4, 2]} />
        <meshStandardMaterial {...steelProps} />
      </mesh>
      {/* Handle */}
      <mesh position={[w / 2 - 50, bodyH * 0.65, d + 5]}>
        <boxGeometry args={[100, 12, 12]} />
        <meshStandardMaterial color="#888" metalness={0.95} roughness={0.1} />
      </mesh>
    </group>
  )
}

function WallCabinet({ item }: { item: CatalogItem }) {
  const { width: w, depth: d, height: h } = item
  const t = 1.5

  return (
    <group position={[0, 1400, 0]}>
      {/* Left */}
      <mesh position={[t / 2, h / 2, d / 2]} castShadow>
        <boxGeometry args={[t, h, d]} />
        <meshStandardMaterial {...steelProps} />
      </mesh>
      {/* Right */}
      <mesh position={[w - t / 2, h / 2, d / 2]} castShadow>
        <boxGeometry args={[t, h, d]} />
        <meshStandardMaterial {...steelProps} />
      </mesh>
      {/* Back */}
      <mesh position={[w / 2, h / 2, t / 2]} castShadow>
        <boxGeometry args={[w, h, t]} />
        <meshStandardMaterial {...steelDark} />
      </mesh>
      {/* Top */}
      <mesh position={[w / 2, h - t / 2, d / 2]} castShadow>
        <boxGeometry args={[w, t, d]} />
        <meshStandardMaterial {...steelProps} />
      </mesh>
      {/* Bottom */}
      <mesh position={[w / 2, t / 2, d / 2]} castShadow>
        <boxGeometry args={[w, t, d]} />
        <meshStandardMaterial {...steelProps} />
      </mesh>
      {/* Door */}
      <mesh position={[w / 2, h / 2, d - 1]} castShadow>
        <boxGeometry args={[w - 4, h - 4, 2]} />
        <meshStandardMaterial {...steelProps} />
      </mesh>
      {/* Handle */}
      <mesh position={[w / 2 - 50, h * 0.35, d + 5]}>
        <boxGeometry args={[100, 12, 12]} />
        <meshStandardMaterial color="#888" metalness={0.95} roughness={0.1} />
      </mesh>
    </group>
  )
}

function Countertop({ item }: { item: CatalogItem }) {
  const { width: w, depth: d, height: h } = item
  return (
    <group position={[0, 850, 0]}>
      <mesh castShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial {...steelProps} />
      </mesh>
    </group>
  )
}

function SinkModel({ item }: { item: CatalogItem }) {
  const { width: w, depth: d, height: h } = item
  return (
    <group position={[0, 850, 0]}>
      {/* Basin */}
      <mesh position={[0, -h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#b0b0b0" metalness={0.95} roughness={0.1} />
      </mesh>
      {/* Rim */}
      <mesh position={[0, 5, 0]}>
        <boxGeometry args={[w + 40, 10, d + 40]} />
        <meshStandardMaterial {...steelProps} />
      </mesh>
    </group>
  )
}

export default function Cabinet3D({ item, position, rotation, isSelected, id }: {
  item: CatalogItem
  position: { x: number; y: number; z: number }
  rotation: number
  isSelected: boolean
  id: string
}) {
  const ref = useRef<THREE.Group>(null)
  const selectItem = usePlacementStore(s => s.selectItem)
  const moveItem = usePlacementStore(s => s.moveItem)
  const [hovered, setHovered] = useState(false)
  const [dragging, setDragging] = useState(false)
  const { camera, raycaster, gl } = useThree()
  const floorPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))
  const dragOffset = useRef(new THREE.Vector3())

  const onPointerDown = useCallback((e: any) => {
    e.stopPropagation()
    selectItem(id)
    setDragging(true)
    // Calculate offset from click point to object origin
    const intersect = new THREE.Vector3()
    raycaster.ray.intersectPlane(floorPlane.current, intersect)
    dragOffset.current.set(intersect.x - position.x, 0, intersect.z - position.z)
    gl.domElement.style.cursor = 'grabbing'
    ;(e as any).target?.setPointerCapture?.(e.pointerId)
  }, [id, position])

  const onPointerMove = useCallback((e: any) => {
    if (!dragging) return
    e.stopPropagation()
    const intersect = new THREE.Vector3()
    raycaster.ray.intersectPlane(floorPlane.current, intersect)
    const newX = intersect.x - dragOffset.current.x
    const newZ = intersect.z - dragOffset.current.z
    moveItem(id, { x: newX, y: 0, z: newZ })
  }, [dragging, id])

  const onPointerUp = useCallback(() => {
    setDragging(false)
    gl.domElement.style.cursor = 'auto'
  }, [])

  const renderItem = () => {
    switch (item.category) {
      case 'base-cabinet': return <BaseCabinet item={item} />
      case 'wall-cabinet': return <WallCabinet item={item} />
      case 'countertop': return <Countertop item={item} />
      case 'sink': return <SinkModel item={item} />
      default: return (
        <mesh position={[item.width / 2, item.height / 2, item.depth / 2]}>
          <boxGeometry args={[item.width, item.height, item.depth]} />
          <meshStandardMaterial {...steelProps} />
        </mesh>
      )
    }
  }

  return (
    <group
      ref={ref}
      position={[position.x, position.y, position.z]}
      rotation={[0, rotation, 0]}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => { setHovered(false); if (!dragging) gl.domElement.style.cursor = 'auto' }}
    >
      {renderItem()}
      {(isSelected || hovered) && (
        <mesh position={[item.width / 2, item.height / 2, item.depth / 2]}>
          <boxGeometry args={[item.width + 10, item.height + 10, item.depth + 10]} />
          <meshBasicMaterial color={isSelected ? '#2563eb' : '#60a5fa'} wireframe transparent opacity={0.4} />
        </mesh>
      )}
    </group>
  )
}
