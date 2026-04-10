import { useState } from 'react'
import { catalogItems, categoryLabels } from '../../data/catalogItems'
import { useUIStore } from '../../store/useUIStore'
import { usePlacementStore } from '../../store/usePlacementStore'
import { Category } from '../../types/kitchen'

const categories: Category[] = ['base-cabinet', 'wall-cabinet', 'countertop', 'sink', 'accessory']

export default function CatalogSidebar() {
  const [activeCategory, setActiveCategory] = useState<Category>('base-cabinet')
  const dragCatalogId = useUIStore(s => s.dragCatalogId)
  const setDragCatalogId = useUIStore(s => s.setDragCatalogId)
  const addItem = usePlacementStore(s => s.addItem)

  const filtered = catalogItems.filter(i => i.category === activeCategory)

  const handlePlace = (id: string) => {
    if (dragCatalogId === id) {
      setDragCatalogId(null)
    } else {
      setDragCatalogId(id)
    }
  }

  const handleQuickAdd = (id: string) => {
    addItem(id)  // auto-place along back wall
  }

  return (
    <div className="flex flex-col h-full">
      {/* Category tabs */}
      <div className="flex flex-wrap gap-1 p-2 border-b border-gray-700">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-2 py-1 text-xs rounded ${
              activeCategory === cat ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {categoryLabels[cat]}
          </button>
        ))}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filtered.map(item => (
          <div
            key={item.id}
            className={`p-2 rounded cursor-pointer border transition-all ${
              dragCatalogId === item.id
                ? 'border-blue-500 bg-blue-900/40'
                : 'border-gray-700 bg-gray-800/50 hover:border-gray-500'
            }`}
            onClick={() => handlePlace(item.id)}
          >
            <div className="flex justify-between items-center">
              <div>
                <div className="text-sm font-medium">{item.nameTH}</div>
                <div className="text-xs text-gray-400">
                  {item.width}x{item.depth}x{item.height} mm
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-blue-400">{item.priceBase.toLocaleString()}</div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleQuickAdd(item.id) }}
                  className="text-xs bg-green-700 hover:bg-green-600 px-2 py-0.5 rounded mt-1"
                >
                  + Add
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {dragCatalogId && (
        <div className="p-2 bg-blue-900/60 text-center text-sm border-t border-blue-700">
          Click in 3D scene to place
        </div>
      )}
    </div>
  )
}
