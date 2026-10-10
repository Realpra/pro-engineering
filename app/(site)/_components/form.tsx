'use client'
import { Plus, X } from 'lucide-react'
import content from '@/content/site-content.json'
import catalogue from '@/content/job-catalogue.json'
import { cn } from '@/lib/utils'
import type { SkillCount } from '../actions'

const f = content.forms

export const inputClass =
  'w-full bg-white border border-stone-300 px-3 py-2.5 text-sm text-[#1F2328] focus:outline-none focus:border-[#1F2328] focus:ring-2 focus:ring-[#F97316]/40 disabled:bg-stone-100 disabled:text-stone-400'

export function Section({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-stone-200">
      <h2 className="flex items-center gap-3 px-5 py-3 border-b border-stone-200 font-black">
        <span className="w-7 h-7 bg-[#1F2328] text-[#F97316] text-xs flex items-center justify-center tabular-nums">{step}</span>
        {title}
      </h2>
      <div className="p-5 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  )
}

export function Field({
  label, optional, hint, wide, group, children,
}: { label: string; optional?: boolean; hint?: string; wide?: boolean; group?: boolean; children: React.ReactNode }) {
  // `group` = the field holds several controls (buttons, checkboxes, rows), so
  // it cannot be one <label>; a fieldset names the whole set instead.
  const Tag = group ? 'fieldset' : 'label'
  const Caption = group ? 'legend' : 'span'
  return (
    <Tag className={cn('block min-w-0', wide && 'sm:col-span-2')}>
      <Caption className="block text-xs font-bold uppercase tracking-wide text-stone-600 mb-1.5">
        {label}
        {optional && <span className="ml-1.5 font-medium normal-case tracking-normal text-stone-400">({f.optional})</span>}
      </Caption>
      {children}
      {hint && <span className="block mt-1.5 text-xs text-stone-500">{hint}</span>}
    </Tag>
  )
}

export function Select({
  value, onChange, options, disabled,
}: { value: string; onChange: (v: string) => void; options: string[]; disabled?: boolean }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled} className={inputClass}>
      <option value="">{f.select}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

export function Choice<T extends string>({
  value, onChange, options,
}: { value: T | ''; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} aria-pressed={value === o.value}
          className={cn(
            'px-4 py-2.5 text-sm font-bold border-2',
            value === o.value
              ? 'bg-[#1F2328] border-[#1F2328] text-white'
              : 'bg-white border-stone-300 text-stone-700 hover:border-[#1F2328]',
          )}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function SkillRows({ rows, onChange }: { rows: SkillCount[]; onChange: (rows: SkillCount[]) => void }) {
  function update(i: number, patch: Partial<SkillCount>) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }
  return (
    <div className="sm:col-span-2 space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="flex gap-2">
          <select value={r.skill} onChange={e => update(i, { skill: e.target.value })} className={inputClass} aria-label={f.fields.skillRow}>
            <option value="">{f.fields.skillRow}</option>
            {catalogue.workerSkills.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input type="number" min={1} value={r.count || ''} onChange={e => update(i, { count: Number(e.target.value) })}
            placeholder={f.fields.skillCount} aria-label={f.fields.skillCount} className={cn(inputClass, 'w-28 shrink-0')} />
          <button type="button" onClick={() => onChange(rows.filter((_, idx) => idx !== i))} disabled={rows.length === 1}
            aria-label={f.remove} className="px-3 border border-stone-300 text-stone-500 hover:text-[#1F2328] disabled:opacity-30">
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...rows, { skill: '', count: 1 }])}
        className="inline-flex items-center gap-1.5 text-sm font-bold text-[#C2570C] hover:text-[#1F2328]">
        <Plus className="w-4 h-4" aria-hidden /> {f.add}
      </button>
    </div>
  )
}

export function FormError({ message }: { message: string }) {
  if (!message) return null
  return (
    <div role="alert" className="bg-red-50 border border-red-300 border-l-4 border-l-red-600 px-4 py-3 text-sm text-red-800">
      <div className="font-bold">{f.errorTitle}</div>
      <div className="mt-0.5 break-words">{message}</div>
    </div>
  )
}

export function SubmitButton({ label, pending }: { label: string; pending: boolean }) {
  return (
    <button type="submit" disabled={pending}
      className="w-full sm:w-auto px-8 py-3.5 bg-[#F97316] text-[#1F2328] font-black hover:bg-[#EA6A0C] disabled:opacity-60">
      {pending ? `${f.submitting}…` : label}
    </button>
  )
}
