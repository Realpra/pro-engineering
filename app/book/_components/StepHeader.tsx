'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

const STEPS = [
  { paths: ['/book'],                                               label: 'Job Type' },
  { paths: ['/book/budget'],                                        label: 'Budget' },
  { paths: ['/book/schedule'],                                      label: 'Schedule & Location' },
  { paths: ['/book/service-model'],                                 label: 'Service Model' },
  { paths: ['/book/site-visit', '/book/civil-site-visit'],         label: 'Site Visit' },
  { paths: ['/book/scope-report'],                                  label: 'Scope Report' },
  { paths: ['/book/estimate'],                                      label: 'Cost Estimate' },
  { paths: ['/book/confirmation'],                                  label: 'Order Confirmation' },
  { paths: ['/book/submit'],                                        label: 'Submit Enquiry' },
]

export default function StepHeader() {
  const pathname = usePathname()
  const idx = STEPS.findIndex(s => s.paths.includes(pathname))
  const step = idx + 1
  const pct = idx >= 0 ? (step / STEPS.length) * 100 : 0
  const backHref = idx > 0 ? STEPS[idx - 1].paths[0] : '/'

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
        <Link
          href={backHref}
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-slate-600" />
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-blue-700 tracking-widest uppercase">
              Pro Engineering
            </span>
            {idx >= 0 && (
              <span className="text-xs text-slate-400 tabular-nums">
                {step} / {STEPS.length}
              </span>
            )}
          </div>
          <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-700 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          {idx >= 0 && (
            <p className="text-[10px] text-slate-500 mt-0.5 truncate">{STEPS[idx].label}</p>
          )}
        </div>
      </div>
    </header>
  )
}
