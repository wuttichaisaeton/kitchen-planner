import { usePlacementStore } from '../../store/usePlacementStore'
import { catalogItems } from '../../data/catalogItems'
import Cabinet3D from './Cabinet3D'

export default function PlacedItems3D() {
  const items = usePlacementStore(s => s.items)
  const selectedId = usePlacementStore(s => s.selectedId)

  return (
    <group>
      {items.map(item => {
        const catItem = catalogItems.find(c => c.id === item.catalogItemId)
        if (!catItem) return null
        return (
          <Cabinet3D
            key={item.id}
            id={item.id}
            item={catItem}
            position={item.position}
            rotation={item.rotation}
            isSelected={item.id === selectedId}
          />
        )
      })}
    </group>
  )
}
