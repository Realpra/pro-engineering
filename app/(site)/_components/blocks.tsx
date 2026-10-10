import Link from 'next/link'
import { cn } from '@/lib/utils'

export function PageHero({ eyebrow, title, intro }: { eyebrow: string; title: string; intro: string }) {
  return (
    <section className="bg-[#1F2328] text-white">
      <div className="max-w-6xl mx-auto px-4 py-14">
        <div className="max-w-3xl border-l-4 border-[#F97316] pl-5">
          <div className="text-xs font-bold uppercase tracking-widest text-[#F97316]">{eyebrow}</div>
          <h1 className="mt-2 text-4xl font-black leading-tight">{title}</h1>
          <p className="mt-3 text-lg text-stone-300 leading-relaxed">{intro}</p>
        </div>
      </div>
    </section>
  )
}

export function SectionHead({ eyebrow, title, intro, dark }: { eyebrow?: string; title: string; intro?: string; dark?: boolean }) {
  return (
    <div className="max-w-2xl mb-10">
      {eyebrow && <div className="text-xs font-bold uppercase tracking-widest text-[#C2570C]">{eyebrow}</div>}
      <h2 className={cn('mt-2 text-3xl font-black leading-tight', dark ? 'text-white' : 'text-[#1F2328]')}>{title}</h2>
      {intro && <p className={cn('mt-3 leading-relaxed', dark ? 'text-stone-300' : 'text-stone-600')}>{intro}</p>}
    </div>
  )
}

export function Band({ children, tone = 'sand', id }: { children: React.ReactNode; tone?: 'sand' | 'white' | 'dark'; id?: string }) {
  return (
    <section id={id} className={cn(
      'scroll-mt-32',
      tone === 'white' && 'bg-white border-y border-stone-200',
      tone === 'dark' && 'bg-[#1F2328]',
    )}>
      <div className="max-w-6xl mx-auto px-4 py-16">{children}</div>
    </section>
  )
}

export function ButtonLink({ href, children, variant = 'primary' }: { href: string; children: React.ReactNode; variant?: 'primary' | 'dark' | 'outline' }) {
  return (
    <Link href={href} className={cn(
      'inline-block px-5 py-3 text-sm font-bold',
      variant === 'primary' && 'bg-[#F97316] text-[#1F2328] hover:bg-[#EA6A0C]',
      variant === 'dark' && 'bg-[#1F2328] text-white hover:bg-black',
      variant === 'outline' && 'border-2 border-[#1F2328] text-[#1F2328] hover:bg-[#1F2328] hover:text-white',
    )}>
      {children}
    </Link>
  )
}
