'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { updatePartnerStatus } from './actions'

type SkillCount = { skill: string; count: number }

export type RequestRow = {
  booking_ref: string
  created_at: string
  status: string | null
  contact_name: string | null
  contact_phone: string | null
  job_title: string | null
  district: string | null
  zone: string | null
  address_line: string | null
  site_state: string | null
  firm_name: string | null
  scope_description: string | null
  preferred_start_date: string | null
  request_type: 'one_day' | 'turn_key' | 'labour_bazaar'
  request_trade: string | null
  request_skill: string | null
  request_job_type: string | null
  lump_sum_package: string | null
  with_material: boolean | null
  work_unit: string | null
  time_from: string | null
  time_to: string | null
  day_slot: string | null
  duration_days: number | null
  skills_required: SkillCount[] | null
}

export type PartnerRow = {
  id: string
  partner_type: 'team_head' | 'associate' | 'contractor'
  created_at: string
  full_name: string
  phone: string
  whatsapp_phone: string | null
  email: string | null
  company_name: string | null
  firm_type: string | null
  gst_number: string | null
  pan_number: string | null
  year_established: number | null
  office_address: string | null
  website_links: string | null
  social_links: string | null
  years_experience: number | null
  work_kinds: string | null
  largest_job: string | null
  client_references: string | null
  team_basis: string | null
  team_package: string | null
  team_composition: SkillCount[] | null
  total_workers: number | null
  site_state: string | null
  districts: string[]
  sectors: string[]
  engagement_types: string[]
  commercial_terms: string | null
  remarks: string | null
  status: string
  staff_note: string | null
}

const REQUEST_LABEL = { one_day: 'One day or smaller', turn_key: 'Turn-key lump sum', labour_bazaar: 'Labour Bazaar' }
const PARTNER_LABEL = { team_head: 'Team Head', associate: 'Associate', contractor: 'Contractor' }
const ENGAGEMENT_LABEL: Record<string, string> = { lead_basis: 'Lead basis', sub_contractor: 'Sub-contractor', labour_provider: 'Labour provider' }
const STATUS_STYLE: Record<string, string> = {
  new: 'bg-amber-100 text-amber-800',
  contacted: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
}

function skillsText(rows: SkillCount[] | null) {
  return (rows ?? []).map(r => `${r.skill} × ${r.count}`).join(', ')
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div>
      <dt className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</dt>
      <dd className="text-sm text-gray-800 break-words">{value}</dd>
    </div>
  )
}

function RequestCard({ r, canOpenEstimate }: { r: RequestRow; canOpenEstimate: boolean }) {
  const timing = r.request_type === 'one_day'
    ? [r.work_unit === 'hours' ? `${r.time_from} to ${r.time_to}` : 'Full day', r.day_slot].filter(Boolean).join(', ')
    : r.duration_days ? `${r.duration_days} days` : null

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <span className="text-xs font-bold text-[#1F3864] bg-blue-50 px-2 py-0.5 rounded">{REQUEST_LABEL[r.request_type]}</span>
          <p className="mt-1.5 font-bold text-gray-900">{r.job_title}</p>
          <p className="text-xs text-gray-500 font-mono">{r.booking_ref} · {formatDate(r.created_at)} · {r.status}</p>
        </div>
        {canOpenEstimate && (
          <Link href={`/admin/estimate/${r.booking_ref}`} className="text-xs font-bold text-white bg-[#1F3864] px-3 py-1.5 rounded-lg">
            Open Estimate Console
          </Link>
        )}
      </div>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Detail label="Client" value={[r.contact_name, r.contact_phone].filter(Boolean).join(' · ')} />
        <Detail label="Firm / site" value={r.firm_name} />
        <Detail label="Trade" value={[r.request_trade, r.request_skill, r.request_job_type].filter(Boolean).join(' > ')} />
        <Detail label="Lump sum job" value={r.lump_sum_package} />
        <Detail label="Material" value={r.with_material === null ? null : r.with_material ? 'With material' : 'Without material'} />
        <Detail label="Date" value={r.preferred_start_date ? formatDate(r.preferred_start_date) : null} />
        <Detail label="Timing" value={timing} />
        <Detail label="Skills and numbers" value={skillsText(r.skills_required)} />
        <Detail label="Location" value={[r.zone, r.district, r.site_state].filter(Boolean).join(', ')} />
        <Detail label="Address" value={r.address_line} />
        <Detail label="Scope" value={r.scope_description} />
      </dl>
    </div>
  )
}

function PartnerCard({ p }: { p: PartnerRow }) {
  const [status, setStatus] = useState(p.status)
  const [note, setNote] = useState(p.staff_note ?? '')
  const [message, setMessage] = useState('')
  const [pending, startTransition] = useTransition()

  function save() {
    setMessage('')
    startTransition(async () => {
      const result = await updatePartnerStatus(p.id, status, note)
      setMessage(result.error ?? 'Saved')
    })
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <span className="text-xs font-bold text-[#1F3864] bg-blue-50 px-2 py-0.5 rounded">{PARTNER_LABEL[p.partner_type]}</span>
          <p className="mt-1.5 font-bold text-gray-900">{p.full_name}{p.company_name ? ` · ${p.company_name}` : ''}</p>
          <p className="text-xs text-gray-500">{formatDate(p.created_at)}</p>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded capitalize ${STATUS_STYLE[p.status] ?? ''}`}>{p.status}</span>
      </div>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Detail label="Phone" value={[p.phone, p.whatsapp_phone && `WhatsApp ${p.whatsapp_phone}`].filter(Boolean).join(' · ')} />
        <Detail label="Email" value={p.email} />
        <Detail label="Firm type" value={[p.firm_type, p.year_established && `est. ${p.year_established}`].filter(Boolean).join(', ')} />
        <Detail label="GST" value={p.gst_number} />
        <Detail label="PAN" value={p.pan_number} />
        <Detail label="Experience" value={p.years_experience !== null ? `${p.years_experience} years` : null} />
        <Detail label="Kinds of work" value={p.work_kinds} />
        <Detail label="Largest job" value={p.largest_job} />
        <Detail label="References" value={p.client_references} />
        <Detail label="Team" value={[p.team_package, skillsText(p.team_composition)].filter(Boolean).join(': ')} />
        <Detail label="Total workers" value={p.total_workers} />
        <Detail label="Works as" value={p.engagement_types.map(e => ENGAGEMENT_LABEL[e] ?? e).join(', ')} />
        <Detail label="State" value={p.site_state} />
        <Detail label="Districts" value={p.districts.join(', ')} />
        <Detail label="Sectors" value={p.sectors.join(', ')} />
        <Detail label="Office" value={p.office_address} />
        <Detail label="Links" value={[p.website_links, p.social_links].filter(Boolean).join(' · ')} />
        <Detail label="Commercial terms" value={p.commercial_terms} />
        <Detail label="Remarks" value={p.remarks} />
      </dl>

      <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Status</span>
          <select value={status} onChange={e => setStatus(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm capitalize">
            {Object.keys(STATUS_STYLE).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="block flex-1 min-w-[200px]">
          <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Staff note</span>
          <input type="text" value={note} onChange={e => setNote(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </label>
        <button type="button" onClick={save} disabled={pending} className="bg-[#1F3864] text-white text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-50">
          {pending ? 'Saving…' : 'Save'}
        </button>
        {message && <span className="text-xs text-gray-600" role="status">{message}</span>}
      </div>
    </div>
  )
}

export default function IntakeBoard({
  requests, partners, canOpenEstimate,
}: { requests: RequestRow[]; partners: PartnerRow[]; canOpenEstimate: boolean }) {
  const [tab, setTab] = useState<'requests' | 'partners'>('requests')

  return (
    <>
      <div className="flex gap-2 mb-4">
        {([['requests', `Job requests (${requests.length})`], ['partners', `Partner registrations (${partners.length})`]] as const).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-bold ${tab === key ? 'bg-[#1F3864] text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {tab === 'requests' && (requests.length === 0
          ? <p className="text-sm text-gray-500">No requests from the website yet.</p>
          : requests.map(r => <RequestCard key={r.booking_ref} r={r} canOpenEstimate={canOpenEstimate} />))}
        {tab === 'partners' && (partners.length === 0
          ? <p className="text-sm text-gray-500">No partner registrations yet.</p>
          : partners.map(p => <PartnerCard key={p.id} p={p} />))}
      </div>
    </>
  )
}
