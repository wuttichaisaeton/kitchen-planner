import { usePlacementStore } from '../../store/usePlacementStore'
import { catalogItems } from '../../data/catalogItems'

export default function PropertiesPanel() {
  const selectedId = usePlacementStore(s => s.selectedId)
  const items = usePlacementStore(s => s.items)
  const moveItem = usePlacementStore(s => s.moveItem)
  const rotateItem = usePlacementStore(s => s.rotateItem)
  const removeItem = usePlacementStore(s => s.removeItem)

  const selected = items.find(i => i.id === selectedId)
  if (!selected) {
    return (
      <div className="p-4 text-center text-gray-500 text-sm">
        Select an item to edit properties
      </div>
    )
  }

  const catItem = catalogItems.find(c => c.id === selected.catalogItemId)
  if (!catItem) return null

  const setPos = (axis: 'x' | 'z', val: number) => {
    moveItem(selected.id, { ...selected.position, [axis]: val })
  }

  return (
    <div className="p-3 space-y-3">
      <div className="text-sm font-bold text-blue-400">{catItem.nameTH}</div>
      <div className="text-xs text-gray-400">{catItem.nameEN}</div>

      <div className="border-t border-gray-700 pt-2 space-y-2">
        <div className="text-xs text-gray-500 uppercase">Dimensions</div>
        <div className="text-sm">{catItem.width} x {catItem.depth} x {catItem.height} mm</div>
      </div>

      <div className="border-t border-gray-700 pt-2 space-y-2">
        <div className="text-xs text-gray-500 uppercase">Position (mm)</div>
        <div className="flex gap-2">
          <label className="flex-1">
            <span className="text-xs text-gray-500">X</span>
            <input
              type="number"
              value={Math.round(selected.position.x)}
              onChange={e => setPos('x', Number(e.target.value))}
              step={50}
              className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
            />
          </label>
          <label className="flex-1">
            <span className="text-xs text-gray-500">Z</span>
            <input
              type="number"
              value={Math.round(selected.position.z)}
              onChange={e => setPos('z', Number(e.target.value))}
              step={50}
              className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
            />
          </label>
        </div>
      </div>

      <div className="border-t border-gray-700 pt-2 space-y-2">
        <div className="text-xs text-gray-500 uppercase">Rotation</div>
        <div className="text-sm">{Math.round((selected.rotation * 180) / Math.PI)}deg</div>
        <button
          onClick={() => rotateItem(selected.id)}
          className="w-full bg-gray-700 hover:bg-gray-600 rounded py-1 text-sm"
        >
          Rotate 90deg
        </button>
      </div>

      <div className="border-t border-gray-700 pt-2 space-y-2">
        <div className="text-xs text-gray-500 uppercase">Price</div>
        <div className="text-lg font-bold text-green-400">
          {catItem.priceBase.toLocaleString()} THB
        </div>
      </div>

      <button
        onClick={() => removeItem(selected.id)}
        className="w-full bg-red-800 hover:bg-red-700 rounded py-1 text-sm"
      >
        Delete
      </button>
    </div>
  )
}
