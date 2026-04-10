import { useUIStore } from '../../store/useUIStore'
import { usePlacementStore } from '../../store/usePlacementStore'
import { catalogItems } from '../../data/catalogItems'
import { ThreeEvent } from '@react-three/fiber'

export default function DropPlane() {
  const dragCatalogId = useUIStore(s => s.dragCatalogId)
  const addItem = usePlacementStore(s => s.addItem)
  const setDragCatalogId = useUIStore(s => s.setDragCatalogId)

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (!dragCatalogId) return
    const catItem = catalogItems.find(c => c.id === dragCatalogId)
    if (!catItem) return

    // Snap to 50mm grid
    const x = Math.round(e.point.x / 50) * 50
    const z = Math.round(e.point.z / 50) * 50

    addItem(dragCatalogId, { x, y: 0, z })
    setDragCatalogId(null)
  }

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[2000, 0.1, 1500]}
      onClick={handleClick}
      visible={false}
    >
      <planeGeometry args={[10000, 10000]} />
      <meshBasicMaterial transparent opacity={0} />
    </mesh>
  )
}
