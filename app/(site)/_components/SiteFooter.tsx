import Link from 'next/link'
import content from '@/content/site-content.json'

const { request, work, header, footer, contact, brand, social, closing } = content

const COLUMNS = [
  {
    title: footer.clientsTitle,
    links: [
      { href: '/request/one-day', label: request.oneDay.title },
      { href: '/request/turn-key', label: request.turnKey.title },
      { href: '/request/labour-bazaar', label: request.bulk.title },
      { href: '/book', label: request.fullProjectCta },
      { href: '/client/login', label: header.clientLogin },
    ],
  },
  {
    title: footer.partnersTitle,
    links: [
      { href: '/for-workers', label: work.worker.title },
      { href: '/work-with-us/team-head', label: work.teamHead.title },
      { href: '/work-with-us/associate', label: work.associate.title },
      { href: '/work-with-us/contractor', label: work.contractor.title },
      { href: '/login', label: header.staffLogin },
    ],
  },
  {
    title: footer.companyTitle,
    links: [
      { href: '/services', label: header.navServices },
      { href: '/zones', label: closing.zones },
      { href: '/resources', label: header.navResources },
      { href: '/blog', label: header.navBlog },
      { href: '/about', label: header.navAbout },
      { href: '/contact', label: closing.contact },
    ],
  },
]

export default function SiteFooter() {
  return (
    <footer className="bg-[#1F2328] text-stone-300">
      <div className="max-w-6xl mx-auto px-4 py-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-5 text-sm">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 bg-[#F97316] text-[#1F2328] font-black text-sm flex items-center justify-center">
              {brand.mark}
            </span>
            <span className="text-white font-bold text-lg leading-none">{brand.name}</span>
          </div>
          <p className="mt-4 leading-relaxed max-w-sm">{footer.about}</p>
          <ul className="mt-5 space-y-1.5">
            <li>{contact.phone}</li>
            <li>{contact.email}</li>
            <li>{contact.address}</li>
            <li>{contact.hours}</li>
          </ul>
          <ul className="mt-4 space-y-1 text-stone-400">
            <li>{social.facebook}</li>
            <li>{social.linkedin}</li>
            <li>{social.youtube}</li>
          </ul>
        </div>

        {COLUMNS.map(col => (
          <div key={col.title}>
            <div className="text-white font-bold mb-3">{col.title}</div>
            <ul className="space-y-2">
              {col.links.map(l => (
                <li key={l.href}><Link href={l.href} className="hover:text-white">{l.label}</Link></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-stone-700">
        <div className="max-w-6xl mx-auto px-4 py-4 text-xs text-stone-400">
          © {new Date().getFullYear()} {footer.copyright}
        </div>
      </div>
    </footer>
  )
}
