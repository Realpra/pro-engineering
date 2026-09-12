'use client'
import { useState, useTransition } from 'react'
import { updateSupervisorChecklist } from './actions'

interface ChecklistItem {
  item: string
  type: string
  checked: boolean
  checked_by: string | null
  checked_at: string | null
}

interface Props {
  substageId: string
  checklist: ChecklistItem[]
  userId: string
}

export default function ChecklistPanel({ substageId, checklist: initial, userId }: Props) {
  const [items, setItems] = useState<ChecklistItem[]>(initial)
  const [isPending, startTransition] = useTransition()

  async function handleTick(index: number) {
    const updated = items.map((item, i) => {
      if (i !== index) return item
      return {
        ...item,
        checked: !item.checked,
        checked_by: !item.checked ? userId : null,
        checked_at: !item.checked ? new Date().toISOString() : null,
      }
    })
    setItems(updated)
    startTransition(async () => {
      await updateSupervisorChecklist(substageId, updated)
    })
  }

  const grouped = {
    base: items.filter(i => i.type === 'base'),
    trade: items.filter(i => i.type === 'trade'),
    substage: items.filter(i => i.type === 'substage'),
    quality: items.filter(i => i.type === 'quality'),
    custom: items.filter(i => i.type === 'custom'),
  }

  const total = items.length
  const checked = items.filter(i => i.checked).length

  const sectionLabel: Record<string, string> = {
    base: 'Base Items — Every Substage',
    trade: 'Trade-Specific Items',
    substage: 'Substage-Specific Items',
    quality: 'Quality Sign-Off',
    custom: 'Custom Items',
  }

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Checklist Progress</p>
          <p className="text-sm font-bold text-[#1F3864]">{checked} of {total} checked</p>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className="bg-[#2E74B5] h-2 rounded-full transition-all"
            style={{ width: total > 0 ? `${(checked / total) * 100}%` : '0%' }}
          />
        </div>
      </div>

      {/* Sections */}
      {Object.entries(grouped).map(([type, groupItems]) => {
        if (groupItems.length === 0) return null
        const groupChecked = groupItems.filter(i => i.checked).length
        return (
          <div key={type} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs font-bold text-[#1F3864] uppercase tracking-wider">{sectionLabel[type]}</p>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${groupChecked === groupItems.length ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {groupChecked}/{groupItems.length}
              </span>
            </div>
            <div className="divide-y divide-gray-100">
              {groupItems.map((item, idx) => {
                const globalIdx = items.findIndex(i => i.item === item.item && i.type === item.type)
                return (
                  <button
                    key={idx}
                    onClick={() => handleTick(globalIdx)}
                    disabled={isPending}
                    className="w-full flex items-start gap-4 px-5 py-4 text-left active:bg-gray-50 transition-colors"
                  >
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${item.checked ? 'bg-[#2E74B5] border-[#2E74B5]' : 'border-gray-300'}`}>
                      {item.checked && (
                        <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm leading-snug ${item.checked ? 'text-gray-400 line-through' : 'text-gray-800 font-medium'}`}>
                        {item.item}
                      </p>
                      {item.checked && item.checked_at && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(item.checked_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}