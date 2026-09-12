'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Home, Droplets, Building2, Monitor, Zap,
  FlaskConical, Layers, BarChart3, Settings,
} from 'lucide-react'
import { saveBooking, getBooking } from '@/lib/booking'
import { cn } from '@/lib/utils'

const JOB_TYPES = [
  {
    id: 'home-renovation',
    title: 'Home Renovation',
    desc: 'Interiors, flooring, painting & full refurbishment',
    icon: Home,
    iconColor: 'text-orange-500',
    iconBg: 'bg-orange-50',
  },
  {
    id: 'leak-proofing',
    title: 'Leak Proofing',
    desc: 'Waterproofing, terrace, basement & seepage repair',
    icon: Droplets,
    iconColor: 'text-blue-500',
    iconBg: 'bg-blue-50',
  },
  {
    id: 'construction',
    title: 'Construction',
    desc: 'New builds, extensions & structural civil works',
    icon: Building2,
    iconColor: 'text-slate-600',
    iconBg: 'bg-slate-100',
  },
  {
    id: 'it-project',
    title: 'IT Project',
    desc: 'Software, infrastructure & digital systems',
    icon: Monitor,
    iconColor: 'text-violet-500',
    iconBg: 'bg-violet-50',
  },
  {
    id: 'clean-energy',
    title: 'Clean Energy',
    desc: 'Solar, EV charging & energy efficiency',
    icon: Zap,
    iconColor: 'text-yellow-500',
    iconBg: 'bg-yellow-50',
  },
  {
    id: 'life-sciences',
    title: 'Life Sciences',
    desc: 'Lab setup, cleanrooms & pharma facilities',
    icon: FlaskConical,
    iconColor: 'text-green-600',
    iconBg: 'bg-green-50',
  },
  {
    id: 'geo-technical',
    title: 'Geo-technical',
    desc: 'Site investigation, soil testing & foundation design',
    icon: Layers,
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-50',
  },
  {
    id: 'project-management',
    title: 'Project Mgmt',
    desc: 'Scheduling, cost control & PM advisory',
    icon: BarChart3,
    iconColor: 'text-indigo-500',
    iconBg: 'bg-indigo-50',
  },
  {
    id: 'manufacturing',
    title: 'Manufacturing',
    desc: 'Factory setup, plant engineering & industrial fit-out',
    icon: Settings,
    iconColor: 'text-rose-500',
    iconBg: 'bg-rose-50',
  },
]

export default function JobSelectionPage() {
  const router = useRouter()
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    const b = getBooking()
    if (b.jobType) setSelected(b.jobType)
  }, [])

  function handleContinue() {
    if (!selected) return
    const job = JOB_TYPES.find(j => j.id === selected)!
    saveBooking({ jobType: selected, jobTitle: job.title })
    router.push('/book/budget')
  }

  return (
    <div className="max-w-2xl mx-auto w-full px-4 py-6 flex flex-col flex-1">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">What are you looking to build?</h1>
        <p className="text-slate-500 text-sm mt-1">Select your project type to get started</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
        {JOB_TYPES.map((job) => {
          const Icon = job.icon
          const active = selected === job.id
          return (
            <button
              key={job.id}
              onClick={() => setSelected(job.id)}
              className={cn(
                'relative flex flex-col gap-3 p-4 rounded-2xl border-2 text-left transition-all duration-150 active:scale-[0.97]',
                active
                  ? 'border-blue-700 bg-blue-700 shadow-lg shadow-blue-200'
                  : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm',
              )}
            >
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                active ? 'bg-white/20' : job.iconBg,
              )}>
                <Icon className={cn('w-5 h-5', active ? 'text-white' : job.iconColor)} />
              </div>
              <div>
                <p className={cn(
                  'text-sm font-semibold leading-snug',
                  active ? 'text-white' : 'text-slate-900',
                )}>
                  {job.title}
                </p>
                <p className={cn(
                  'text-xs mt-0.5 leading-relaxed',
                  active ? 'text-blue-100' : 'text-slate-500',
                )}>
                  {job.desc}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      <div className="mt-auto pt-4">
        <button
          onClick={handleContinue}
          disabled={!selected}
          className={cn(
            'w-full py-4 rounded-2xl font-semibold text-base transition-all',
            selected
              ? 'bg-blue-700 text-white hover:bg-blue-800 shadow-lg shadow-blue-200 active:scale-[0.98]'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed',
          )}
        >
          Continue →
        </button>
      </div>
    </div>
  )
}
