import { usePlacementStore } from '../../store/usePlacementStore'
import { catalogItems } from '../../data/catalogItems'
import { useMemo } from 'react'

export default function QuotationPanel() {
  const items = usePlacementStore(s => s.items)

  const bom = useMemo(() => {
    const counts: Record<string, number> = {}
    items.forEach(i => {
      counts[i.catalogItemId] = (counts[i.catalogItemId] || 0) + 1
    })

    const lines = Object.entries(counts).map(([catId, qty]) => {
      const catItem = catalogItems.find(c => c.id === catId)
      if (!catItem) return null
      return {
        item: catItem,
        qty,
        unitPrice: catItem.priceBase,
        lineTotal: catItem.priceBase * qty,
      }
    }).filter(Boolean) as { item: typeof catalogItems[0]; qty: number; unitPrice: number; lineTotal: number }[]

    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0)
    const labor = Math.round(subtotal * 0.3)
    const margin = Math.round((subtotal + labor) * 0.25)
    const beforeVat = subtotal + labor + margin
    const vat = Math.round(beforeVat * 0.07)
    const grandTotal = beforeVat + vat

    return { lines, subtotal, labor, margin, vat, grandTotal }
  }, [items])

  if (items.length === 0) {
    return <div className="p-4 text-gray-500 text-sm text-center">No items placed yet</div>
  }

  return (
    <div className="p-3 space-y-3 text-sm overflow-y-auto h-full">
      <div className="font-bold text-blue-400">BOM / Quotation</div>

      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-500 border-b border-gray-700">
            <th className="text-left py-1">Item</th>
            <th className="text-right">Qty</th>
            <th className="text-right">Unit</th>
            <th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {bom.lines.map(line => (
            <tr key={line.item.id} className="border-b border-gray-800">
              <td className="py-1">{line.item.nameTH}</td>
              <td className="text-right">{line.qty}</td>
              <td className="text-right">{line.unitPrice.toLocaleString()}</td>
              <td className="text-right">{line.lineTotal.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="border-t border-gray-600 pt-2 space-y-1">
        <div className="flex justify-between"><span>Subtotal</span><span>{bom.subtotal.toLocaleString()}</span></div>
        <div className="flex justify-between text-gray-400"><span>Labor (30%)</span><span>{bom.labor.toLocaleString()}</span></div>
        <div className="flex justify-between text-gray-400"><span>Margin (25%)</span><span>{bom.margin.toLocaleString()}</span></div>
        <div className="flex justify-between text-gray-400"><span>VAT (7%)</span><span>{bom.vat.toLocaleString()}</span></div>
        <div className="flex justify-between font-bold text-lg text-green-400 border-t border-gray-600 pt-1">
          <span>Grand Total</span>
          <span>{bom.grandTotal.toLocaleString()} THB</span>
        </div>
      </div>

      <button
        className="w-full bg-blue-700 hover:bg-blue-600 rounded py-2 text-sm font-bold"
        onClick={() => alert('PDF export coming soon!')}
      >
        Export PDF Quotation
      </button>
    </div>
  )
}
