import type { ReactElement } from 'react'
import { useUIStore, type SketchTool } from '../../store/useUIStore'
import { useRoomStore } from '../../store/useRoomStore'

const tools: { id: SketchTool; label: string; group: string; shortcut: string; icon: ReactElement }[] = [
  // ─── CREATE ───
  {
    id: 'line', label: 'Line', group: 'CREATE', shortcut: 'L',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
        <line x1="4" y1="20" x2="20" y2="4" />
        <circle cx="4" cy="20" r="2" fill="currentColor" />
        <circle cx="20" cy="4" r="2" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: 'rectangle', label: 'Rectangle', group: 'CREATE', shortcut: 'R',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x="3" y="5" width="18" height="14" rx="0.5" />
        <circle cx="3" cy="5" r="1.5" fill="currentColor" />
        <circle cx="21" cy="5" r="1.5" fill="currentColor" />
        <circle cx="21" cy="19" r="1.5" fill="currentColor" />
        <circle cx="3" cy="19" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: 'construction', label: 'Guide', group: 'CREATE', shortcut: 'X',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
        <line x1="4" y1="20" x2="20" y2="4" strokeDasharray="3 3" opacity={0.8} />
        <circle cx="4" cy="20" r="1.5" fill="currentColor" opacity={0.5} />
        <circle cx="20" cy="4" r="1.5" fill="currentColor" opacity={0.5} />
      </svg>
    ),
  },
  {
    id: 'door', label: 'Door', group: 'CREATE', shortcut: 'O',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <rect x="7" y="3" width="10" height="18" rx="0.5" />
        <path d="M7 21 Q7 10 17 10" strokeDasharray="2 2" />
        <circle cx="15" cy="13" r="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: 'window', label: 'Window', group: 'CREATE', shortcut: 'N',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <rect x="4" y="5" width="16" height="14" rx="0.5" />
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <rect x="5" y="6" width="6" height="5" fill="rgba(100,180,255,0.2)" stroke="none" />
        <rect x="13" y="6" width="6" height="5" fill="rgba(100,180,255,0.2)" stroke="none" />
      </svg>
    ),
  },
  {
    id: 'fixed-glass', label: 'Fixed', group: 'CREATE', shortcut: 'I',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <rect x="4" y="5" width="16" height="14" rx="0.5" />
        <line x1="4" y1="5" x2="20" y2="19" strokeWidth={1} opacity={0.5} />
        <line x1="20" y1="5" x2="4" y2="19" strokeWidth={1} opacity={0.5} />
        <rect x="5" y="6" width="14" height="12" fill="rgba(100,180,255,0.2)" stroke="none" />
      </svg>
    ),
  },
  {
    id: 'column', label: 'Column', group: 'CREATE', shortcut: 'P',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <rect x="7" y="7" width="10" height="10" fill="currentColor" opacity={0.2} />
        <rect x="7" y="7" width="10" height="10" />
        <line x1="12" y1="3" x2="12" y2="7" strokeDasharray="1.5 1.5" />
        <line x1="12" y1="17" x2="12" y2="21" strokeDasharray="1.5 1.5" />
        <line x1="3" y1="12" x2="7" y2="12" strokeDasharray="1.5 1.5" />
        <line x1="17" y1="12" x2="21" y2="12" strokeDasharray="1.5 1.5" />
      </svg>
    ),
  },

  // ─── MODIFY ───
  {
    id: 'select', label: 'Select', group: 'MODIFY', shortcut: 'ESC',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="M5 3l12 9-5 1.5-3 5.5z" fill="currentColor" opacity={0.15} />
        <path d="M5 3l12 9-5 1.5-3 5.5z" />
        <path d="M12 12l4 7" strokeWidth={1.5} />
      </svg>
    ),
  },
  {
    id: 'trim', label: 'Trim', group: 'MODIFY', shortcut: 'T',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <line x1="4" y1="4" x2="20" y2="4" />
        <line x1="4" y1="20" x2="20" y2="20" />
        <line x1="8" y1="8" x2="16" y2="16" stroke="#ff6666" strokeWidth={1.5} />
        <line x1="16" y1="8" x2="8" y2="16" stroke="#ff6666" strokeWidth={1.5} />
      </svg>
    ),
  },
  {
    id: 'offset', label: 'Offset', group: 'MODIFY', shortcut: 'F',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <line x1="6" y1="4" x2="6" y2="20" />
        <line x1="18" y1="4" x2="18" y2="20" />
        <path d="M9 12l3-2.5M9 12l3 2.5" />
        <line x1="9" y1="12" x2="15" y2="12" />
        <path d="M15 12l-3-2.5M15 12l-3 2.5" />
      </svg>
    ),
  },
  {
    id: 'fillet', label: 'Fillet', group: 'MODIFY', shortcut: 'G',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <line x1="4" y1="20" x2="4" y2="10" />
        <path d="M4 10 Q4 4 10 4" />
        <line x1="10" y1="4" x2="20" y2="4" />
      </svg>
    ),
  },
  {
    id: 'mirror', label: 'Mirror', group: 'MODIFY', shortcut: 'M',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <line x1="12" y1="2" x2="12" y2="22" strokeDasharray="2 2" stroke="#66aaff" />
        <polygon points="5,8 9,8 9,16 5,16" strokeWidth={1.5} />
        <polygon points="15,8 19,8 19,16 15,16" strokeWidth={1.5} opacity={0.4} />
      </svg>
    ),
  },

  // ─── CONSTRAINTS (Fusion 360 style) ───
  {
    id: 'hv', label: 'H/V', group: 'CONSTRAINTS', shortcut: 'H',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
        {/* Fusion 360 style H/V — horizontal line with vertical constraint marks */}
        <line x1="3" y1="16" x2="21" y2="16" />
        <line x1="12" y1="4" x2="12" y2="12" strokeDasharray="2 2" strokeOpacity={0.5} />
        <line x1="8" y1="12" x2="16" y2="12" stroke="#ffaa00" strokeWidth={1.5} />
        <line x1="8" y1="10" x2="8" y2="14" stroke="#ffaa00" strokeWidth={1.5} />
        <line x1="16" y1="10" x2="16" y2="14" stroke="#ffaa00" strokeWidth={1.5} />
      </svg>
    ),
  },
  {
    id: 'perpendicular', label: 'Perp.', group: 'CONSTRAINTS', shortcut: 'Q',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
        {/* Right angle symbol */}
        <line x1="4" y1="20" x2="4" y2="4" />
        <line x1="4" y1="20" x2="20" y2="20" />
        <rect x="4" y="14" width="6" height="6" fill="none" strokeWidth={1.2} />
      </svg>
    ),
  },
  {
    id: 'equal', label: 'Equal', group: 'CONSTRAINTS', shortcut: 'E',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
        <line x1="5" y1="10" x2="19" y2="10" />
        <line x1="5" y1="14" x2="19" y2="14" />
      </svg>
    ),
  },
  {
    id: 'parallel', label: 'Parallel', group: 'CONSTRAINTS', shortcut: '/',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
        <line x1="6" y1="20" x2="14" y2="4" />
        <line x1="10" y1="20" x2="18" y2="4" />
      </svg>
    ),
  },
  {
    id: 'coincident', label: 'Coinc.', group: 'CONSTRAINTS', shortcut: 'J',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
        <line x1="4" y1="18" x2="12" y2="6" />
        <line x1="12" y1="6" x2="20" y2="18" />
        <circle cx="12" cy="6" r="3" fill="#ffaa00" stroke="#ffaa00" strokeWidth={1.5} />
      </svg>
    ),
  },
  {
    id: 'fix', label: 'Fix', group: 'CONSTRAINTS', shortcut: 'K',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <rect x="6" y="11" width="12" height="10" rx="1.5" fill="currentColor" opacity={0.15} />
        <rect x="6" y="11" width="12" height="10" rx="1.5" />
        <path d="M9 11V8a3 3 0 016 0v3" />
        <circle cx="12" cy="16" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: 'symmetric', label: 'Symm.', group: 'CONSTRAINTS', shortcut: 'S',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <line x1="12" y1="2" x2="12" y2="22" strokeDasharray="2 2" stroke="#ffaa00" />
        <polygon points="5,8 10,12 5,16" fill="currentColor" opacity={0.3} />
        <polygon points="19,8 14,12 19,16" fill="currentColor" opacity={0.3} />
        <polygon points="5,8 10,12 5,16" />
        <polygon points="19,8 14,12 19,16" />
      </svg>
    ),
  },

  // ─── INSPECT ───
  {
    id: 'dimension', label: 'Dimension', group: 'INSPECT', shortcut: 'D',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <line x1="4" y1="12" x2="20" y2="12" />
        <path d="M4 12l3-2.5M4 12l3 2.5" />
        <path d="M20 12l-3-2.5M20 12l-3 2.5" />
        <line x1="4" y1="7" x2="4" y2="17" strokeWidth={1} />
        <line x1="20" y1="7" x2="20" y2="17" strokeWidth={1} />
        <text x="12" y="10" textAnchor="middle" fill="currentColor" fontSize="6" fontWeight="bold" stroke="none">mm</text>
      </svg>
    ),
  },
]

const statusText: Record<string, string> = {
  select: 'Click to select and move walls or openings',
  line: 'Click to place wall start, click again for end. ESC to cancel.',
  rectangle: 'Click first corner, then opposite corner. ESC to cancel.',
  construction: 'Click to draw guide/construction line. ESC to cancel.',
  dimension: 'Click on a wall — dimension opens for editing immediately.',
  door: 'Click on a wall to add a door',
  window: 'Click on a wall to add a window',
  'fixed-glass': 'Click on a wall to add fixed glass',
  column: 'Click to place a column. ESC to cancel.',
  trim: 'Click on a wall, guide, or column to delete it.',
  offset: 'Select a wall, then specify offset distance.',
  fillet: 'Click a corner to add fillet radius.',
  mirror: 'Select elements, then click mirror line.',
  hv: 'Click a wall to snap it Horizontal or Vertical (whichever is closer).',
  perpendicular: 'Click first wall, then second wall to make them perpendicular.',
  equal: 'Click first wall, then second wall to make equal length.',
  parallel: 'Click first wall, then second wall to make parallel.',
  coincident: 'Click two endpoints to merge them together.',
  fix: 'Click a wall or point to lock its position.',
  symmetric: 'Click two walls and a center line for symmetry.',
}

export default function SketchToolbar() {
  const sketchTool = useUIStore(s => s.sketchTool)
  const setSketchTool = useUIStore(s => s.setSketchTool)

  const groups = ['CREATE', 'MODIFY', 'CONSTRAINTS', 'INSPECT'] as const
  const grouped = groups.map(g => ({
    name: g,
    items: tools.filter(t => t.group === g),
  })).filter(g => g.items.length > 0)

  return (
    <div className="flex flex-col shrink-0">
      <div className="h-[54px] bg-[#1e1e30] border-b border-gray-700/50 flex items-end px-2 pb-1 gap-0.5 overflow-x-auto shrink-0 sticky top-0 z-50">
        {grouped.map((group, gi) => (
          <div key={group.name} className="flex items-end gap-0.5 shrink-0">
            {gi > 0 && <div className="w-px h-10 bg-gray-600/40 mx-1 mb-0.5" />}
            <div className="flex flex-col items-center">
              <div className="flex gap-px">
                {group.items.map(tool => (
                  <button
                    key={tool.id}
                    onClick={() => setSketchTool(tool.id)}
                    title={`${tool.label} (${tool.shortcut})`}
                    className={`flex flex-col items-center justify-center w-10 h-10 rounded transition-all ${
                      sketchTool === tool.id
                        ? 'bg-blue-600/30 border border-blue-500/60 text-blue-300'
                        : 'hover:bg-gray-700/40 text-gray-400 hover:text-gray-200 border border-transparent'
                    }`}
                  >
                    {tool.icon}
                    <span className="text-[7px] mt-px leading-none">{tool.label}</span>
                  </button>
                ))}
              </div>
              <span className="text-[7px] text-gray-500 mt-px">{group.name}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SketchStatusBar() {
  const sketchTool = useUIStore(s => s.sketchTool)
  const applyHVAll = useRoomStore(s => s.applyHVConstraintAll)
  return (
    <div className="h-7 bg-[#161628] border-t border-gray-700/50 flex items-center px-3 gap-3">
      <span className="text-[11px] text-gray-400 flex-1">{statusText[sketchTool] || 'Select a tool'}</span>
      {sketchTool === 'hv' && (
        <button
          onClick={applyHVAll}
          className="bg-amber-700 hover:bg-amber-600 text-white text-[10px] font-bold px-3 py-0.5 rounded"
        >
          H/V All
        </button>
      )}
    </div>
  )
}
