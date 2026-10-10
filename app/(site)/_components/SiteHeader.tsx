import Link from 'next/link'
import { Phone } from 'lucide-react'
import content from '@/content/site-content.json'

const { header, contact, brand } = content

const NAV = [
  { href: '/#request', label: header.navRequest },
  { href: '/#work', label: header.navWork },
  { href: '/services', label: header.navServices },
  { href: '/zones', label: header.navZones },
  { href: '/resources', label: header.navResources },
  { href: '/blog', label: header.navBlog },
  { href: '/about', label: header.navAbout },
  { href: '/contact', label: header.navContact },
]

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-30">
      <div className="bg-[#1F2328] text-stone-200">
        <div className="max-w-6xl mx-auto px-4 h-9 flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 min-w-0">
            <Phone className="w-3.5 h-3.5 shrink-0 text-[#F97316]" aria-hidden />
            <span className="truncate">{contact.phone}</span>
          </span>
          <span className="flex items-center gap-4 shrink-0">
            <Link href="/login" className="hover:text-white">{header.staffLogin}</Link>
            <Link href="/client/login" className="hover:text-white">{header.clientLogin}</Link>
          </span>
        </div>
      </div>

      <div className="bg-white border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <span className="w-9 h-9 bg-[#F97316] text-[#1F2328] font-black text-sm flex items-center justify-center">
              {brand.mark}
            </span>
            <span className="text-[#1F2328] font-bold text-lg leading-none">{brand.name}</span>
          </Link>

          <nav className="hidden xl:flex items-center gap-5 text-sm font-medium text-stone-700">
            {NAV.map(n => (
              <Link key={n.href} href={n.href} className="hover:text-[#1F2328] hover:underline underline-offset-8 decoration-[#F97316] decoration-2">
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <Link href="/#request" className="px-3.5 py-2 bg-[#F97316] text-[#1F2328] text-sm font-bold hover:bg-[#EA6A0C]">
              {header.ctaPost}
            </Link>
            <Link href="/#work" className="hidden sm:block px-3.5 py-2 border-2 border-[#1F2328] text-[#1F2328] text-sm font-bold hover:bg-[#1F2328] hover:text-white">
              {header.ctaJoin}
            </Link>
          </div>
        </div>

        <nav className="xl:hidden border-t border-stone-100 overflow-x-auto">
          <div className="flex gap-5 px-4 py-2 text-sm font-medium text-stone-700 whitespace-nowrap">
            {NAV.map(n => (
              <Link key={n.href} href={n.href}>{n.label}</Link>
            ))}
          </div>
        </nav>
      </div>
    </header>
  )
}
